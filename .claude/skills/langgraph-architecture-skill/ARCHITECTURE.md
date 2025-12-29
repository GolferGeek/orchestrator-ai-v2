# LangGraph Architecture

LangGraph workflow architecture patterns and structure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              LangGraph Workflow Engine                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │         HTTP Endpoints (Controllers)            │  │
│  │  POST /workflows/[agent-name]                    │  │
│  └────────────────┬────────────────────────────────┘  │
│                   │                                     │
│  ┌────────────────▼────────────────────────────────┐  │
│  │         Services (Workflow Management)          │  │
│  │  - Create and initialize graphs                 │  │
│  │  - Execute workflows                           │  │
│  │  - Handle state management                     │  │
│  └────────────────┬────────────────────────────────┘  │
│                   │                                     │
│  ┌────────────────▼────────────────────────────────┐  │
│  │         Workflow Graphs (StateGraph)            │  │
│  │  - Nodes (async functions)                     │  │
│  │  - Edges (conditional/unconditional)           │  │
│  │  - State annotations (with ExecutionContext)     │  │
│  └────────────────┬────────────────────────────────┘  │
│                   │                                     │
│  ┌────────────────┼────────────────────────────────┐  │
│  │                │                                 │  │
│  │  ┌─────────────▼──────────────┐                │  │
│  │  │  LLM Service (HTTP Client)  │                │  │
│  │  │  POST /llm/generate         │                │  │
│  │  └─────────────────────────────┘                │  │
│  │                                                 │  │
│  │  ┌─────────────▼──────────────┐                │  │
│  │  │  Observability (HTTP Client)│                │  │
│  │  │  POST /webhooks/status     │                │  │
│  │  └─────────────────────────────┘                │  │
│  │                                                 │  │
│  │  ┌─────────────▼──────────────┐                │  │
│  │  │  Postgres Checkpointer     │                │  │
│  │  │  State persistence         │                │  │
│  │  └─────────────────────────────┘                │  │
│  │                                                 │  │
│  │  ┌─────────────▼──────────────┐                │  │
│  │  │  Tools (Custom Tools)      │                │  │
│  │  │  Database, API, etc.       │                │  │
│  │  └─────────────────────────────┘                │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Workflow Structure

### Graph Creation

**Pattern:**
```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { MyWorkflowStateAnnotation } from "./my-workflow.state";

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

### State Annotation

**Base State (with ExecutionContext):**
```typescript
import { Annotation } from "@langchain/langgraph";

export const BaseStateAnnotation = Annotation.Root({
  // ExecutionContext fields
  taskId: Annotation<string>({ reducer: (_, next) => next, default: () => "" }),
  userId: Annotation<string>({ reducer: (_, next) => next, default: () => "" }),
  conversationId: Annotation<string | undefined>({ reducer: (_, next) => next, default: () => undefined }),
  agentSlug: Annotation<string>({ reducer: (_, next) => next, default: () => "" }),
  organizationSlug: Annotation<string | undefined>({ reducer: (_, next) => next, default: () => undefined }),
  provider: Annotation<string>({ reducer: (_, next) => next, default: () => "anthropic" }),
  model: Annotation<string>({ reducer: (_, next) => next, default: () => "claude-sonnet-4-20250514" }),
  
  // Message history
  ...MessagesAnnotation.spec,
  
  // HITL fields
  hitlRequest: Annotation<HitlStateType["hitlRequest"]>({ reducer: (_, next) => next, default: () => undefined }),
  hitlResponse: Annotation<HitlStateType["hitlResponse"]>({ reducer: (_, next) => next, default: () => undefined }),
  hitlStatus: Annotation<"none" | "waiting" | "resumed">({ reducer: (_, next) => next, default: () => "none" }),
});
```

**Workflow-Specific State:**
```typescript
export const MyWorkflowStateAnnotation = Annotation.Root({
  ...BaseStateAnnotation.spec, // Includes ExecutionContext
  
  // Workflow-specific fields
  userMessage: Annotation<string>({ reducer: (_, next) => next, default: () => "" }),
  result: Annotation<unknown>({ reducer: (_, next) => next, default: () => undefined }),
  status: Annotation<string>({ reducer: (_, next) => next, default: () => "started" }),
});
```

### Node Functions

**Node Pattern:**
```typescript
async function processNode(
  state: MyWorkflowState,
): Promise<Partial<MyWorkflowState>> {
  const ctx = state.executionContext; // ExecutionContext from state

  // Emit observability event
  await observability.emit({
    context: ctx, // Full ExecutionContext
    threadId: ctx.taskId,
    status: "processing",
    message: "Processing workflow step",
    step: "process",
    progress: 50,
  });

  // Call LLM service
  const llmResponse = await llmClient.callLLM({
    context: ctx, // Full ExecutionContext
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

## Service Integration

### LLM Service

**Pattern:**
- LangGraph calls LLM service via HTTP to API endpoint
- Use `LLMHttpClientService` for all LLM calls
- Pass full ExecutionContext in request
- Automatic usage tracking, costing, and PII processing
- See `LLM_SERVICE.md` for details

### Observability Service

**Pattern:**
- LangGraph sends observability events via HTTP to API endpoint
- Use `ObservabilityService` for all observability events
- Pass full ExecutionContext in event
- Non-blocking - failures don't break workflow
- See `OBSERVABILITY.md` for details

### Checkpointing

**Pattern:**
- Postgres-based state persistence
- Use `PostgresCheckpointerService` for checkpointing
- State persisted between workflow steps
- Supports workflow resumption

## HITL (Human-in-the-Loop)

**Pattern:**
- HITL state fields in state annotation
- HITL nodes pause workflow and wait for human input
- Observability events notify frontend of HITL request
- Frontend sends HITL response via API
- Workflow resumes with HITL response

## Tools

**Pattern:**
- Custom tools extend `BaseTool` from LangChain
- Tools can access ExecutionContext if needed
- Tools are called directly from nodes (not via ToolNode)
- Tools can call external services, databases, APIs

## ExecutionContext Flow

**Pattern:**
1. ExecutionContext received from API request (controller)
2. ExecutionContext stored in initial state
3. ExecutionContext flows through all nodes
4. ExecutionContext passed to LLM service calls
5. ExecutionContext passed to observability events
6. ExecutionContext never created or modified (except taskId when first created)

## Database-Driven State (Complex Flows)

For complex workflows requiring persistent state, multi-phase execution, or complex state transitions, use a **database-driven state machine** pattern.

**Pattern:**
- Database tables ARE the state machine
- Service layer reads/writes to database
- State transitions are database updates
- Suitable for complex, multi-phase workflows

**See `DATABASE_STATE.md` for complete details.**

## Related

- **`PATTERNS.md`**: LangGraph-specific patterns
- **`LLM_SERVICE.md`**: LLM service integration
- **`OBSERVABILITY.md`**: Observability integration
- **`DATABASE_STATE.md`**: Database-driven state for complex flows

