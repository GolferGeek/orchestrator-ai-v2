---
name: LangGraph Development
description: Prescriptive patterns for building LangGraph workflows that integrate with Orchestrator AI. Enforces ExecutionContext flow, HITL patterns, observability, and LLM service integration. Use when building or reviewing LangGraph workflows, agents, or graph nodes.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# LangGraph Development Skill

This skill enforces **prescriptive patterns** for building LangGraph workflows that integrate seamlessly with Orchestrator AI's architecture. It ensures ExecutionContext flows correctly, HITL (Human-in-the-Loop) is implemented properly, and all LangGraph constructs are used correctly.

## Core Principle: Framework-Agnostic Integration

LangGraph workflows are **framework-agnostic** - they don't directly access the database or create entities. Instead, they:
1. **Receive ExecutionContext** from the API Runner
2. **Call back to the API** for LLM requests and observability
3. **Return structured results** that the API Runner processes
4. **Use checkpoints** for state persistence and HITL

**NEVER** construct ExecutionContext in LangGraph. **NEVER** access the database directly. **ALWAYS** pass the whole ExecutionContext capsule to services.

## ExecutionContext Flow

### ✅ CORRECT: ExecutionContext in State

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { ExecutionContext } from "@orchestrator-ai/transport-types";

export const MyAgentStateAnnotation = Annotation.Root({
  // Include message history
  ...MessagesAnnotation.spec,

  // ExecutionContext - the core context capsule
  executionContext: Annotation<ExecutionContext>({
    reducer: (_, next) => next,
    default: () => ({
      orgSlug: "", userId: "", conversationId: "", taskId: "",
      planId: NIL_UUID, deliverableId: NIL_UUID,
      agentSlug: "", agentType: "", provider: "", model: "",
    }),
  }),

  // Agent-specific fields...
});
```

### ✅ CORRECT: Accessing ExecutionContext in Nodes

```typescript
async function myNode(state: MyAgentState): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext; // Get the whole capsule
  
  // Use ctx for all services
  await observability.emitProgress(ctx, ctx.taskId, "Processing...");
  const result = await llmClient.callLLM({
    context: ctx, // Pass whole capsule
    userMessage: "...",
    systemMessage: "...",
  });
  
  return { /* updated state */ };
}
```

### ❌ WRONG: Constructing or Cherry-Picking Context

```typescript
// ❌ BAD - Constructing context
const newContext: ExecutionContext = {
  orgSlug: '...', userId: '...', // DON'T DO THIS
};

// ❌ BAD - Cherry-picking fields
await service.call(userId, taskId, conversationId); // DON'T DO THIS

// ✅ GOOD - Pass whole capsule
await service.call(ctx); // DO THIS
```

## LangGraph Core Constructs

### StateGraph Builder Pattern

```typescript
import { StateGraph, END, interrupt } from "@langchain/langgraph";

export function createMyAgentGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
) {
  // Define nodes
  async function startNode(state: MyAgentState): Promise<Partial<MyAgentState>> {
    const ctx = state.executionContext;
    await observability.emitStarted(ctx, ctx.taskId, "Starting...");
    return { status: "processing", startedAt: Date.now() };
  }

  // Build graph
  const graph = new StateGraph(MyAgentStateAnnotation)
    .addNode("start", startNode)
    .addNode("process", processNode)
    .addNode("finalize", finalizeNode)
    // Edges
    .addEdge("__start__", "start")
    .addEdge("start", "process")
    .addConditionalEdges("process", (state) => {
      if (state.error) return "handle_error";
      return "finalize";
    })
    .addEdge("finalize", END);

  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}
```

### Node Functions

**Pattern:**
- Nodes are `async` functions that take `state` and return `Partial<State>`
- Always extract `executionContext` from state first
- Use `executionContext` for all service calls
- Return partial state updates

```typescript
async function processNode(
  state: MyAgentState,
): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext;

  // Emit observability
  await observability.emitProgress(ctx, ctx.taskId, "Processing...");

  // Call LLM with full context
  const result = await llmClient.callLLM({
    context: ctx,
    userMessage: state.userMessage,
    systemMessage: "You are a helpful assistant.",
  });

  // Update messages
  return {
    result: result.text,
    messages: [
      ...state.messages,
      new AIMessage(result.text),
    ],
  };
}
```

### Conditional Edges and Routing

**Simple Conditional:**
```typescript
.addConditionalEdges("process", (state) => {
  if (state.error) return "handle_error";
  if (state.needsMoreInfo) return "gather_info";
  return "finalize";
})
```

**Named Routing Function:**
```typescript
function routeAfterHitl(state: MyAgentState): string {
  switch (state.hitlDecision) {
    case "approve": return "continue";
    case "reject": return "finalize_rejected";
    case "regenerate": return "regenerate";
    default: throw new Error(`Invalid decision: ${state.hitlDecision}`);
  }
}

.addConditionalEdges("hitl_interrupt", routeAfterHitl, {
  continue: "finalize",
  finalize_rejected: "finalize_rejected",
  regenerate: "regenerate",
})
```

## Human-in-the-Loop (HITL) Patterns

### HITL State Annotation

```typescript
import { HitlBaseStateAnnotation } from "../../hitl/hitl-base.state";

export const MyAgentStateAnnotation = Annotation.Root({
  ...HitlBaseStateAnnotation.spec, // Includes ExecutionContext + HITL fields
  // Agent-specific fields...
});
```

### Interrupt Node

```typescript
async function hitlInterruptNode(
  state: MyAgentState,
): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext;

  // Emit observability before interrupt
  await observability.emitHitlWaiting(
    ctx,
    ctx.taskId,
    state.pendingContent,
    "Awaiting human review",
  );

  // interrupt() pauses the graph here
  // On initial call: throws GraphInterrupt, checkpoints state
  // On resume: returns the value passed via Command({ resume: value })
  const hitlResponse = interrupt({
    reason: "human_review",
    nodeName: "hitl_interrupt",
    content: state.pendingContent,
    message: "Please review before continuing",
  }) as HitlResponse | undefined;

  // If undefined, we're still waiting (shouldn't happen)
  if (!hitlResponse) {
    return { hitlPending: true, status: "hitl_waiting" };
  }

  // Extract decision and update state
  const { decision, feedback, editedContent } = hitlResponse;
  return {
    hitlPending: false,
    hitlDecision: decision,
    hitlFeedback: feedback || null,
    // Update content if provided
    content: editedContent || state.content,
    status: decision === "reject" ? "rejected" : "processing",
  };
}
```

### Resuming from HITL

```typescript
// In service (NestJS)
import { Command, isGraphInterrupt } from "@langchain/langgraph";

async function generate(input: MyAgentInput): Promise<MyAgentResult> {
  try {
    const result = await this.graph.invoke(initialState, {
      configurable: { thread_id: input.context.taskId },
    });
    // ... handle success
  } catch (error) {
    if (isGraphInterrupt(error)) {
      // Graph paused for HITL
      const state = await this.graph.getState({
        configurable: { thread_id: input.context.taskId },
      });
      return {
        taskId: input.context.taskId,
        status: "hitl_waiting",
        pendingContent: state.values.pendingContent,
      };
    }
    throw error;
  }
}

async function resume(taskId: string, response: HitlResponse): Promise<MyAgentResult> {
  const result = await this.graph.invoke(
    new Command({ resume: response }),
    { configurable: { thread_id: taskId } },
  );
  // ... handle resumed execution
}
```

### HITL Routing

```typescript
function routeAfterHitl(state: MyAgentState): string {
  switch (state.hitlDecision) {
    case "approve":
    case "skip":
      return "continue";
    case "replace":
      return "finalize"; // Content already updated
    case "regenerate":
      return "regenerate";
    case "reject":
      return "finalize_rejected";
    default:
      throw new Error(`Invalid HITL decision: ${state.hitlDecision}`);
  }
}

.addConditionalEdges("hitl_interrupt", routeAfterHitl, {
  continue: "next_step",
  regenerate: "regenerate",
  finalize: "finalize",
  finalize_rejected: "finalize_rejected",
})
```

## Service Integration

### LLM Service Calls

**Pattern:**
- Always pass full `ExecutionContext` to `llmClient.callLLM()`
- Provider and model come from `context.provider` and `context.model`
- Never hardcode provider/model in LangGraph

```typescript
const result = await llmClient.callLLM({
  context: state.executionContext, // Full capsule
  userMessage: state.userMessage,
  systemMessage: "You are a helpful assistant.",
  temperature: 0.7,
  maxTokens: 3500,
  callerName: "my_agent_node",
});
```

### Observability Events

**Pattern:**
- Always pass full `ExecutionContext` to observability methods
- Use `context.taskId` as `threadId`
- Emit events at key workflow points

```typescript
// Started
await observability.emitStarted(
  ctx,
  ctx.taskId,
  "Workflow started",
);

// Progress
await observability.emitProgress(
  ctx,
  ctx.taskId,
  "Processing step 2 of 5",
  {
    step: "process_data",
    progress: 40,
    metadata: { itemsProcessed: 10 },
  },
);

// HITL
await observability.emitHitlWaiting(
  ctx,
  ctx.taskId,
  state.pendingContent,
  "Awaiting human review",
);

// Completed
await observability.emitCompleted(
  ctx,
  ctx.taskId,
  { result: state.result },
  Date.now() - state.startedAt,
);
```

## Checkpointing and State Persistence

### Checkpointer Configuration

```typescript
// In graph creation
return graph.compile({
  checkpointer: checkpointer.getSaver(),
});

// When invoking
const config = {
  configurable: {
    thread_id: context.taskId, // Use taskId as thread_id
  },
};

const result = await graph.invoke(initialState, config);
const state = await graph.getState(config);
```

### State Access

```typescript
// Get current state
const state = await this.graph.getState({
  configurable: { thread_id: taskId },
});

// Check if interrupted
const isInterrupted = state.next && state.next.length > 0;

// Access state values
const values = state.values as MyAgentState;
```

## Message History

### Using MessagesAnnotation

```typescript
import { MessagesAnnotation } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

export const MyAgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec, // Includes messages array
  // Other fields...
});

// In nodes
return {
  messages: [
    ...state.messages,
    new HumanMessage("User input"),
    new AIMessage("AI response"),
  ],
};
```

## Tools Integration

### Direct Tool Calls (Recommended Pattern)

**Pattern:**
- Tools are NestJS injectable services
- Call tools directly via their methods (not via ToolNode)
- Pass ExecutionContext subset for usage reporting

```typescript
// In node
const result = await sqlQueryTool.generateAndExecuteSql(
  question,
  schemaContext,
  {
    userId: ctx.userId,
    taskId: ctx.taskId,
    threadId: ctx.taskId,
    conversationId: ctx.conversationId,
  },
);
```

### Tool Observability

```typescript
await observability.emitToolCalling(
  ctx,
  ctx.taskId,
  "execute_sql",
  { query: sql },
);

const result = await tool.execute(sql);

await observability.emitToolCompleted(
  ctx,
  ctx.taskId,
  "execute_sql",
  true,
  result,
);
```

## Error Handling

### Error Node Pattern

```typescript
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

// In graph
.addNode("handle_error", handleErrorNode)
.addConditionalEdges("process", (state) => {
  if (state.error) return "handle_error";
  return "continue";
})
.addEdge("handle_error", END)
```

## Graph Invocation Pattern

### Service Method

```typescript
async function generate(input: MyAgentInput): Promise<MyAgentResult> {
  const { context } = input;
  const taskId = context.taskId;

  // Initial state with ExecutionContext
  const initialState: Partial<MyAgentState> = {
    executionContext: context, // Pass whole capsule
    userMessage: input.userMessage,
    status: "started",
    startedAt: Date.now(),
  };

  const config = {
    configurable: {
      thread_id: taskId, // Use taskId as thread_id
    },
  };

  try {
    const result = await this.graph.invoke(initialState, config);
    // ... handle success
  } catch (error) {
    if (isGraphInterrupt(error)) {
      // Handle HITL interrupt
    }
    // ... handle other errors
  }
}
```

## Anti-Patterns to Avoid

1. **❌ Constructing ExecutionContext in LangGraph**
   - Context must come from API Runner
   - Never create new context objects

2. **❌ Cherry-picking context fields**
   - Always pass whole `ExecutionContext` capsule
   - Never pass individual fields like `userId`, `taskId` separately

3. **❌ Direct database access**
   - LangGraph is framework-agnostic
   - Use API services or tools instead

4. **❌ Hardcoding provider/model**
   - Provider/model come from `ExecutionContext`
   - Never hardcode in workflow code

5. **❌ Skipping observability events**
   - Emit events at all key workflow points
   - Use appropriate event types

6. **❌ Not using checkpointer**
   - All graphs must use checkpointer
   - Required for HITL and state persistence

7. **❌ Incorrect HITL patterns**
   - Must emit `emitHitlWaiting` before `interrupt()`
   - Must use `Command({ resume })` to resume
   - Must handle `isGraphInterrupt` errors

## Integration with Other Skills

- **Execution Context Skill**: Ensures ExecutionContext flows correctly
- **Transport Types Skill**: Ensures A2A compliance for agent endpoints
- **Quality Gates Skill**: Validates LangGraph patterns during PR review

## Related Files

- **State Annotations**: `apps/langgraph/src/hitl/hitl-base.state.ts`
- **HITL Helper**: `apps/langgraph/src/services/hitl-helper.service.ts`
- **LLM Client**: `apps/langgraph/src/services/llm-http-client.service.ts`
- **Observability**: `apps/langgraph/src/services/observability.service.ts`
- **Checkpointer**: `apps/langgraph/src/persistence/postgres-checkpointer.service.ts`
- **Example Graphs**: 
  - `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts`
  - `apps/langgraph/src/agents/data-analyst/data-analyst.graph.ts`
  - `apps/langgraph/src/agents/marketing-swarm/marketing-swarm.graph.ts`

For detailed examples of correct patterns, see `PATTERNS.md`.
For violations and fixes, see `VIOLATIONS.md`.
For LangGraph construct reference, see `CONSTRUCTS.md`.
For HITL deep dive, see `HITL.md`.

