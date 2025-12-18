# LangGraph Development Violations

Common mistakes and how to fix them.

## ExecutionContext Violations

### ❌ Violation: Constructing ExecutionContext

```typescript
// ❌ BAD - Constructing context in LangGraph
async function myNode(state: MyAgentState): Promise<Partial<MyAgentState>> {
  const newContext: ExecutionContext = {
    orgSlug: 'my-org',
    userId: 'user-123',
    conversationId: 'conv-456',
    taskId: 'task-789',
    planId: NIL_UUID,
    deliverableId: NIL_UUID,
    agentSlug: 'my-agent',
    agentType: 'langgraph',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  };
  
  await service.call(newContext);
}
```

**Fix:**
```typescript
// ✅ GOOD - Use context from state
async function myNode(state: MyAgentState): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext; // Get from state
  
  await service.call(ctx); // Pass whole capsule
}
```

### ❌ Violation: Cherry-Picking Context Fields

```typescript
// ❌ BAD - Passing individual fields
async function myNode(state: MyAgentState): Promise<Partial<MyAgentState>> {
  await observability.emitProgress(
    state.userId,
    state.taskId,
    "Processing...",
  );
  
  await llmClient.callLLM({
    userId: state.userId,
    taskId: state.taskId,
    provider: state.provider,
    model: state.model,
  });
}
```

**Fix:**
```typescript
// ✅ GOOD - Pass whole ExecutionContext
async function myNode(state: MyAgentState): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext;
  
  await observability.emitProgress(ctx, ctx.taskId, "Processing...");
  
  await llmClient.callLLM({
    context: ctx, // Whole capsule
    userMessage: "...",
  });
}
```

### ❌ Violation: Missing ExecutionContext in State

```typescript
// ❌ BAD - State without ExecutionContext
export const MyAgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<string>({ ... }),
  taskId: Annotation<string>({ ... }),
  provider: Annotation<string>({ ... }),
  model: Annotation<string>({ ... }),
  // Missing executionContext!
});
```

**Fix:**
```typescript
// ✅ GOOD - Include ExecutionContext
export const MyAgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
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

## HITL Violations

### ❌ Violation: Missing Observability Before Interrupt

```typescript
// ❌ BAD - No observability event
async function hitlNode(state: MyAgentState): Promise<Partial<MyAgentState>> {
  const interruptValue = interrupt({
    reason: "review",
    content: state.draft,
  });
  // Missing emitHitlWaiting!
}
```

**Fix:**
```typescript
// ✅ GOOD - Emit observability first
async function hitlNode(state: MyAgentState): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext;
  
  await observability.emitHitlWaiting(
    ctx,
    ctx.taskId,
    state.draft,
    "Awaiting review",
  );
  
  const interruptValue = interrupt({
    reason: "review",
    content: state.draft,
  });
}
```

### ❌ Violation: Incorrect Resume Pattern

```typescript
// ❌ BAD - Not using Command
async function resume(taskId: string, response: HitlResponse) {
  const result = await this.graph.invoke(response, {
    configurable: { thread_id: taskId },
  });
}
```

**Fix:**
```typescript
// ✅ GOOD - Use Command({ resume })
import { Command } from "@langchain/langgraph";

async function resume(taskId: string, response: HitlResponse) {
  const result = await this.graph.invoke(
    new Command({ resume: response }),
    { configurable: { thread_id: taskId } },
  );
}
```

### ❌ Violation: Not Handling GraphInterrupt

```typescript
// ❌ BAD - Not catching interrupt
async function generate(input: MyAgentInput) {
  const result = await this.graph.invoke(initialState, config);
  // If interrupt occurs, this will throw unhandled error
}
```

**Fix:**
```typescript
// ✅ GOOD - Handle interrupt
import { isGraphInterrupt } from "@langchain/langgraph";

async function generate(input: MyAgentInput) {
  try {
    const result = await this.graph.invoke(initialState, config);
    // ... handle success
  } catch (error) {
    if (isGraphInterrupt(error)) {
      // Handle HITL interrupt
      const state = await this.graph.getState(config);
      return { status: "hitl_waiting", ... };
    }
    throw error;
  }
}
```

## Service Integration Violations

### ❌ Violation: Hardcoding Provider/Model

```typescript
// ❌ BAD - Hardcoded provider/model
async function myNode(state: MyAgentState) {
  const result = await llmClient.callLLM({
    context: state.executionContext,
    userMessage: "...",
    options: {
      provider: "anthropic", // Hardcoded!
      model: "claude-sonnet-4", // Hardcoded!
    },
  });
}
```

**Fix:**
```typescript
// ✅ GOOD - Use context provider/model
async function myNode(state: MyAgentState) {
  const ctx = state.executionContext;
  
  const result = await llmClient.callLLM({
    context: ctx, // Provider/model come from context
    userMessage: "...",
  });
}
```

### ❌ Violation: Missing Observability Events

```typescript
// ❌ BAD - No observability
async function myNode(state: MyAgentState) {
  const result = await llmClient.callLLM({
    context: state.executionContext,
    userMessage: "...",
  });
  // Missing observability events!
  return { result: result.text };
}
```

**Fix:**
```typescript
// ✅ GOOD - Emit observability
async function myNode(state: MyAgentState) {
  const ctx = state.executionContext;
  
  await observability.emitProgress(ctx, ctx.taskId, "Processing...");
  
  const result = await llmClient.callLLM({
    context: ctx,
    userMessage: "...",
  });
  
  await observability.emitProgress(ctx, ctx.taskId, "Completed");
  
  return { result: result.text };
}
```

## Graph Structure Violations

### ❌ Violation: Missing Checkpointer

```typescript
// ❌ BAD - No checkpointer
return graph.compile();
```

**Fix:**
```typescript
// ✅ GOOD - Include checkpointer
return graph.compile({
  checkpointer: checkpointer.getSaver(),
});
```

### ❌ Violation: Wrong thread_id

```typescript
// ❌ BAD - Using wrong ID
const config = {
  configurable: {
    thread_id: state.conversationId, // Wrong!
  },
};
```

**Fix:**
```typescript
// ✅ GOOD - Use taskId
const config = {
  configurable: {
    thread_id: context.taskId, // Correct!
  },
};
```

### ❌ Violation: Missing Error Handling

```typescript
// ❌ BAD - No error node
const graph = new StateGraph(MyAgentStateAnnotation)
  .addNode("process", processNode)
  .addEdge("process", "finalize");
  // No error handling!
```

**Fix:**
```typescript
// ✅ GOOD - Include error handling
const graph = new StateGraph(MyAgentStateAnnotation)
  .addNode("process", processNode)
  .addNode("handle_error", handleErrorNode)
  .addConditionalEdges("process", (state) => {
    if (state.error) return "handle_error";
    return "finalize";
  })
  .addEdge("handle_error", END);
```

## State Annotation Violations

### ❌ Violation: Missing MessagesAnnotation

```typescript
// ❌ BAD - No message history
export const MyAgentStateAnnotation = Annotation.Root({
  executionContext: Annotation<ExecutionContext>({ ... }),
  // Missing MessagesAnnotation!
});
```

**Fix:**
```typescript
// ✅ GOOD - Include MessagesAnnotation
import { MessagesAnnotation } from "@langchain/langgraph";

export const MyAgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec, // Include message history
  executionContext: Annotation<ExecutionContext>({ ... }),
});
```

### ❌ Violation: Incorrect Reducer

```typescript
// ❌ BAD - Wrong reducer for array
toolResults: Annotation<ToolResult[]>({
  reducer: (_, next) => next, // Replaces array instead of appending
  default: () => [],
}),
```

**Fix:**
```typescript
// ✅ GOOD - Append to array
toolResults: Annotation<ToolResult[]>({
  reducer: (prev, next) => [...prev, ...next], // Append
  default: () => [],
}),
```

## Tool Integration Violations

### ❌ Violation: Not Emitting Tool Observability

```typescript
// ❌ BAD - No tool observability
async function queryNode(state: MyAgentState) {
  const result = await sqlTool.execute(sql);
  return { result };
}
```

**Fix:**
```typescript
// ✅ GOOD - Emit tool observability
async function queryNode(state: MyAgentState) {
  const ctx = state.executionContext;
  
  await observability.emitToolCalling(ctx, ctx.taskId, "execute_sql");
  
  const result = await sqlTool.execute(sql);
  
  await observability.emitToolCompleted(
    ctx,
    ctx.taskId,
    "execute_sql",
    true,
    result,
  );
  
  return { result };
}
```

