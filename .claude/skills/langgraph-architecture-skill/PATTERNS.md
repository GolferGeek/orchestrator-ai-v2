# LangGraph Patterns

LangGraph-specific patterns and best practices.

## Workflow Patterns

### Graph Creation Pattern

```typescript
export function createMyWorkflowGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
) {
  const graph = new StateGraph(MyWorkflowStateAnnotation);

  // Add nodes
  graph.addNode("start", startNode);
  graph.addNode("process", processNode);
  graph.addNode("complete", completeNode);

  // Add edges
  graph.addEdge("start", "process");
  graph.addConditionalEdges("process", shouldComplete);
  graph.addEdge("complete", END);

  // Set entry point
  graph.setEntryPoint("start");

  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getCheckpointer(),
  });
}
```

### Node Pattern

```typescript
async function processNode(
  state: MyWorkflowState,
): Promise<Partial<MyWorkflowState>> {
  const ctx = state.executionContext; // ExecutionContext from state

  // Emit observability event
  await observability.emit({
    context: ctx,
    threadId: ctx.taskId,
    status: "processing",
    message: "Processing step",
    step: "process",
    progress: 50,
  });

  // Call LLM service
  const llmResponse = await llmClient.callLLM({
    context: ctx,
    systemMessage: "System prompt",
    userMessage: state.userMessage,
    callerName: "my-workflow",
  });

  return {
    result: llmResponse.text,
    status: "completed",
  };
}
```

### Conditional Edge Pattern

```typescript
function shouldComplete(state: MyWorkflowState): string {
  if (state.status === "completed") {
    return "complete";
  } else if (state.status === "failed") {
    return END;
  } else {
    return "process";
  }
}
```

## ExecutionContext Patterns

### Storing ExecutionContext in State

```typescript
// In state annotation
export const MyWorkflowStateAnnotation = Annotation.Root({
  ...BaseStateAnnotation.spec, // Includes ExecutionContext fields
  // ... other fields
});

// In initial state
const initialState: Partial<MyWorkflowState> = {
  executionContext: context, // Full ExecutionContext
  userMessage: input.userMessage,
  status: "started",
};
```

### Passing ExecutionContext to Services

```typescript
// ✅ CORRECT: Pass full ExecutionContext
await llmClient.callLLM({
  context: state.executionContext, // Full ExecutionContext
  systemMessage: "System prompt",
  userMessage: state.userMessage,
});

// ❌ WRONG: Cherry-pick fields
await llmClient.callLLM({
  userId: state.executionContext.userId, // WRONG
  taskId: state.executionContext.taskId, // WRONG
  // ...
});
```

## LLM Service Patterns

### Calling LLM Service

```typescript
import { LLMHttpClientService } from "../../services/llm-http-client.service";

// In node function
const response = await llmClient.callLLM({
  context: state.executionContext, // REQUIRED - full ExecutionContext
  systemMessage: "System prompt",
  userMessage: "User message",
  temperature: 0.7,
  maxTokens: 3500,
  callerName: "workflow-name", // Track caller for analytics
});

// Response includes:
// - text: LLM response
// - usage: Token counts and cost
```

**Key Points:**
- LLM service is called via HTTP to API endpoint (`POST /llm/generate`)
- ExecutionContext is REQUIRED in request
- Automatic usage tracking, costing, and PII processing
- See `LLM_SERVICE.md` for complete details

## Observability Patterns

### Emitting Observability Events

```typescript
import { ObservabilityService } from "../../services/observability.service";

// In node function
await observability.emit({
  context: state.executionContext, // REQUIRED - full ExecutionContext
  threadId: state.executionContext.taskId,
  status: "started" | "processing" | "completed" | "failed",
  message: "Human-readable message",
  step: "Current step name",
  progress: 50, // 0-100
  metadata: {
    // Additional event data
  },
});
```

**Key Points:**
- Observability events sent via HTTP to API endpoint (`POST /webhooks/status`)
- ExecutionContext is REQUIRED in event
- Non-blocking - failures don't break workflow
- See `OBSERVABILITY.md` for complete details

## HITL Patterns

### HITL State Fields

```typescript
// In state annotation
hitlRequest: Annotation<HitlStateType["hitlRequest"]>({
  reducer: (_, next) => next,
  default: () => undefined,
}),

hitlResponse: Annotation<HitlStateType["hitlResponse"]>({
  reducer: (_, next) => next,
  default: () => undefined,
}),

hitlStatus: Annotation<"none" | "waiting" | "resumed">({
  reducer: (_, next) => next,
  default: () => "none",
}),
```

### HITL Node Pattern

```typescript
async function hitlNode(
  state: MyWorkflowState,
): Promise<Partial<MyWorkflowState>> {
  const ctx = state.executionContext;

  // Request HITL
  await observability.emit({
    context: ctx,
    threadId: ctx.taskId,
    status: "hitl_waiting",
    message: "Waiting for human approval",
  });

  return {
    hitlStatus: "waiting",
    hitlRequest: {
      type: "approval",
      message: "Approve this action?",
      options: ["approve", "reject"],
    },
  };
}
```

### HITL Resume Pattern

```typescript
async function resumeNode(
  state: MyWorkflowState,
): Promise<Partial<MyWorkflowState>> {
  const ctx = state.executionContext;

  // Process HITL response
  if (state.hitlResponse?.action === "approve") {
    await observability.emit({
      context: ctx,
      threadId: ctx.taskId,
      status: "hitl_resumed",
      message: "HITL approved, continuing workflow",
    });

    return {
      hitlStatus: "resumed",
      // Continue workflow
    };
  } else {
    return {
      hitlStatus: "resumed",
      status: "failed",
      error: "HITL rejected",
    };
  }
}
```

## Tool Patterns

### Custom Tool Pattern

```typescript
import { BaseTool } from "@langchain/core/tools";

export class MyTool extends BaseTool {
  name = "my_tool";
  description = "Tool description";

  async _call(input: string): Promise<string> {
    // Tool implementation
    return "Tool result";
  }
}
```

### Tool Usage in Nodes

```typescript
// Tools called directly from nodes (not via ToolNode)
const tool = new MyTool();
const result = await tool._call("input");
```

## Checkpointing Patterns

### Checkpointer Setup

```typescript
import { PostgresCheckpointerService } from "../../persistence/postgres-checkpointer.service";

// In graph compilation
const graph = new StateGraph(MyWorkflowStateAnnotation);
// ... add nodes and edges
return graph.compile({
  checkpointer: checkpointer.getCheckpointer(),
});
```

### Workflow Execution with Checkpointing

```typescript
// In service
const config = {
  configurable: {
    thread_id: context.taskId, // Use taskId as thread ID
  },
};

const finalState = await this.graph.invoke(initialState, config);
```

## Service Patterns

### Service Initialization

```typescript
@Injectable()
export class MyWorkflowService implements OnModuleInit {
  private graph: CompiledStateGraph;

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly observability: ObservabilityService,
    private readonly checkpointer: PostgresCheckpointerService,
  ) {}

  async onModuleInit() {
    this.graph = createMyWorkflowGraph(
      this.llmClient,
      this.observability,
      this.checkpointer,
    );
  }
}
```

### Controller Pattern

```typescript
@Controller("workflows/my-workflow")
export class MyWorkflowController {
  constructor(private readonly service: MyWorkflowService) {}

  @Post()
  async execute(@Body() dto: MyWorkflowRequestDto) {
    // Extract ExecutionContext from DTO
    const context: ExecutionContext = {
      taskId: dto.taskId,
      userId: dto.userId,
      conversationId: dto.conversationId,
      agentSlug: "my-workflow",
      provider: dto.provider,
      model: dto.model,
      // ... other ExecutionContext fields
    };

    return await this.service.execute({
      executionContext: context,
      userMessage: dto.prompt,
    });
  }
}
```

## Related

- **`ARCHITECTURE.md`**: Architecture overview
- **`LLM_SERVICE.md`**: LLM service integration details
- **`OBSERVABILITY.md`**: Observability integration details

