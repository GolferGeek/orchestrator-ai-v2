# LangGraph Development Patterns

Detailed examples of correct LangGraph workflow patterns.

## Complete Workflow Example

### State Definition

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { ExecutionContext, NIL_UUID } from "@orchestrator-ai/transport-types";
import { HitlBaseStateAnnotation } from "../../hitl/hitl-base.state";

export const MyAgentStateAnnotation = Annotation.Root({
  // Include message history
  ...MessagesAnnotation.spec,

  // Include HITL base (includes ExecutionContext)
  ...HitlBaseStateAnnotation.spec,

  // Agent-specific fields
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  result: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Status tracking
  status: Annotation<"started" | "processing" | "completed" | "failed">({
    reducer: (_, next) => next,
    default: () => "started",
  }),
});

export type MyAgentState = typeof MyAgentStateAnnotation.State;
```

### Graph Creation

```typescript
import { StateGraph, END, interrupt } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

export function createMyAgentGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
) {
  // Node: Initialize
  async function initializeNode(
    state: MyAgentState,
  ): Promise<Partial<MyAgentState>> {
    const ctx = state.executionContext;

    await observability.emitStarted(
      ctx,
      ctx.taskId,
      `Starting workflow: ${state.userMessage}`,
    );

    return {
      status: "processing",
      startedAt: Date.now(),
      messages: [new HumanMessage(state.userMessage)],
    };
  }

  // Node: Process
  async function processNode(
    state: MyAgentState,
  ): Promise<Partial<MyAgentState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      "Processing request",
      { step: "process", progress: 50 },
    );

    const result = await llmClient.callLLM({
      context: ctx,
      userMessage: state.userMessage,
      systemMessage: "You are a helpful assistant.",
      callerName: "my_agent_process",
    });

    return {
      result: result.text,
      messages: [
        ...state.messages,
        new AIMessage(result.text),
      ],
    };
  }

  // Node: Finalize
  async function finalizeNode(
    state: MyAgentState,
  ): Promise<Partial<MyAgentState>> {
    const ctx = state.executionContext;

    await observability.emitCompleted(
      ctx,
      ctx.taskId,
      { result: state.result },
      Date.now() - state.startedAt,
    );

    return {
      status: "completed",
      completedAt: Date.now(),
    };
  }

  // Node: Handle Error
  async function handleErrorNode(
    state: MyAgentState,
  ): Promise<Partial<MyAgentState>> {
    const ctx = state.executionContext;

    await observability.emitFailed(
      ctx,
      ctx.taskId,
      state.error || "Unknown error",
      Date.now() - state.startedAt,
    );

    return {
      status: "failed",
      completedAt: Date.now(),
    };
  }

  // Build graph
  const graph = new StateGraph(MyAgentStateAnnotation)
    .addNode("initialize", initializeNode)
    .addNode("process", processNode)
    .addNode("finalize", finalizeNode)
    .addNode("handle_error", handleErrorNode)
    // Edges
    .addEdge("__start__", "initialize")
    .addEdge("initialize", "process")
    .addConditionalEdges("process", (state) => {
      if (state.error) return "handle_error";
      return "finalize";
    })
    .addEdge("finalize", END)
    .addEdge("handle_error", END);

  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}
```

### Service Integration

```typescript
@Injectable()
export class MyAgentService implements OnModuleInit {
  private graph: ReturnType<typeof createMyAgentGraph>;

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly observability: ObservabilityService,
    private readonly checkpointer: PostgresCheckpointerService,
  ) {}

  async onModuleInit() {
    this.graph = createMyAgentGraph(
      this.llmClient,
      this.observability,
      this.checkpointer,
    );
  }

  async generate(input: MyAgentInput): Promise<MyAgentResult> {
    const { context } = input;
    const taskId = context.taskId;

    const initialState: Partial<MyAgentState> = {
      executionContext: context,
      userMessage: input.userMessage,
      status: "started",
      startedAt: Date.now(),
    };

    const config = {
      configurable: {
        thread_id: taskId,
      },
    };

    try {
      const result = await this.graph.invoke(initialState, config);
      return {
        taskId,
        status: result.status,
        result: result.result,
      };
    } catch (error) {
      if (isGraphInterrupt(error)) {
        // Handle HITL interrupt
        const state = await this.graph.getState(config);
        return {
          taskId,
          status: "hitl_waiting",
          pendingContent: state.values.pendingContent,
        };
      }
      throw error;
    }
  }
}
```

## HITL Pattern Example

### HITL Interrupt Node

```typescript
async function hitlInterruptNode(
  state: MyAgentState,
): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext;

  // Prepare content for review
  const pendingContent = {
    draft: state.draft,
    metadata: state.metadata,
  };

  // Emit observability before interrupt
  await observability.emitHitlWaiting(
    ctx,
    ctx.taskId,
    pendingContent,
    "Draft ready for review",
  );

  // interrupt() pauses here
  const hitlResponse = interrupt({
    reason: "human_review",
    nodeName: "hitl_interrupt",
    content: pendingContent,
    message: "Please review the draft before finalizing",
  }) as HitlResponse | undefined;

  if (!hitlResponse) {
    return { hitlPending: true, status: "hitl_waiting" };
  }

  const { decision, feedback, editedContent } = hitlResponse;

  return {
    hitlPending: false,
    hitlDecision: decision,
    hitlFeedback: feedback || null,
    draft: editedContent?.draft || state.draft,
    status: decision === "reject" ? "rejected" : "processing",
  };
}
```

### HITL Routing

```typescript
function routeAfterHitl(state: MyAgentState): string {
  switch (state.hitlDecision) {
    case "approve":
    case "skip":
      return "finalize";
    case "replace":
      return "finalize"; // Content already updated in state
    case "regenerate":
      return "regenerate";
    case "reject":
      return "finalize_rejected";
    default:
      throw new Error(`Invalid HITL decision: ${state.hitlDecision}`);
  }
}

// In graph
.addConditionalEdges("hitl_interrupt", routeAfterHitl, {
  finalize: "finalize",
  regenerate: "regenerate",
  finalize_rejected: "finalize_rejected",
})
```

### HITL Resume

```typescript
async function resume(
  taskId: string,
  response: HitlResponse,
): Promise<MyAgentResult> {
  const config = {
    configurable: {
      thread_id: taskId,
    },
  };

  const result = await this.graph.invoke(
    new Command({ resume: response }),
    config,
  );

  return {
    taskId,
    status: result.status,
    result: result.result,
  };
}
```

## Tool Integration Pattern

### Direct Tool Call

```typescript
async function queryDatabaseNode(
  state: MyAgentState,
): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext;

  await observability.emitToolCalling(
    ctx,
    ctx.taskId,
    "execute_sql",
    { query: state.sqlQuery },
  );

  try {
    const result = await sqlQueryTool.executeSql(
      state.sqlQuery,
      undefined,
      {
        userId: ctx.userId,
        taskId: ctx.taskId,
        threadId: ctx.taskId,
        conversationId: ctx.conversationId,
      },
    );

    await observability.emitToolCompleted(
      ctx,
      ctx.taskId,
      "execute_sql",
      true,
      result,
    );

    return {
      sqlResult: result,
      toolResults: [
        ...state.toolResults,
        { toolName: "execute_sql", result, success: true },
      ],
    };
  } catch (error) {
    await observability.emitToolCompleted(
      ctx,
      ctx.taskId,
      "execute_sql",
      false,
      undefined,
      error.message,
    );

    return {
      error: error.message,
      toolResults: [
        ...state.toolResults,
        { toolName: "execute_sql", result: error.message, success: false },
      ],
    };
  }
}
```

## Conditional Routing Patterns

### Simple Conditional

```typescript
.addConditionalEdges("process", (state) => {
  if (state.error) return "handle_error";
  if (state.needsMoreInfo) return "gather_info";
  return "continue";
})
```

### Complex Conditional with Named Function

```typescript
function routeAfterAnalysis(state: MyAgentState): string {
  if (state.error) return "handle_error";
  
  if (state.analysisResult.confidence < 0.7) {
    return "request_clarification";
  }
  
  if (state.analysisResult.requiresApproval) {
    return "hitl_interrupt";
  }
  
  return "finalize";
}

.addConditionalEdges("analyze", routeAfterAnalysis, {
  handle_error: "handle_error",
  request_clarification: "gather_info",
  hitl_interrupt: "hitl_interrupt",
  finalize: "finalize",
})
```

### Multi-Output Conditional

```typescript
function routeToMultipleNodes(state: MyAgentState): string[] {
  const routes: string[] = [];
  
  if (state.needsValidation) {
    routes.push("validate");
  }
  
  if (state.needsEnrichment) {
    routes.push("enrich");
  }
  
  return routes.length > 0 ? routes : ["finalize"];
}

.addConditionalEdges("process", routeToMultipleNodes)
```

## Message History Pattern

```typescript
// Initialize with user message
return {
  messages: [new HumanMessage(state.userMessage)],
};

// Add AI response
return {
  messages: [
    ...state.messages,
    new AIMessage(result.text),
  ],
};

// Add system message (if needed)
return {
  messages: [
    ...state.messages,
    new SystemMessage("System notification"),
  ],
};
```

## Error Handling Pattern

```typescript
async function processNode(
  state: MyAgentState,
): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext;

  try {
    const result = await llmClient.callLLM({
      context: ctx,
      userMessage: state.userMessage,
    });

    return {
      result: result.text,
      error: undefined, // Clear any previous errors
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      status: "failed",
    };
  }
}

// Route to error handler
.addConditionalEdges("process", (state) => {
  if (state.error) return "handle_error";
  return "continue";
})
```

## State Reducer Patterns

### Replace (Default)

```typescript
myField: Annotation<string>({
  reducer: (_, next) => next, // Replace with new value
  default: () => "",
}),
```

### Merge (Objects)

```typescript
metadata: Annotation<Record<string, any>>({
  reducer: (prev, next) => ({ ...prev, ...next }), // Merge objects
  default: () => ({}),
}),
```

### Append (Arrays)

```typescript
toolResults: Annotation<ToolResult[]>({
  reducer: (prev, next) => [...prev, ...next], // Append to array
  default: () => [],
}),
```

### Accumulate (Numbers)

```typescript
totalCost: Annotation<number>({
  reducer: (prev, next) => (prev || 0) + (next || 0), // Sum values
  default: () => 0,
}),
```

