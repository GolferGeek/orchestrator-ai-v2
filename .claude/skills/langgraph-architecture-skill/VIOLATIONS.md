# LangGraph Architecture Violations

Common violations and their fixes.

## ExecutionContext Violations

### ❌ Creating ExecutionContext

```typescript
// ❌ WRONG: Creating ExecutionContext
const context: ExecutionContext = {
  taskId: uuidv4(),
  userId: "user-id",
  // ...
};
```

**✅ FIX: Receive ExecutionContext from request**
```typescript
// ✅ CORRECT: Receive ExecutionContext from request
const context = dto.executionContext; // From DTO/request
```

### ❌ Cherry-Picking ExecutionContext Fields

```typescript
// ❌ WRONG: Cherry-picking fields
await llmClient.callLLM({
  userId: state.executionContext.userId,
  taskId: state.executionContext.taskId,
  // ...
});
```

**✅ FIX: Pass full ExecutionContext**
```typescript
// ✅ CORRECT: Pass full ExecutionContext
await llmClient.callLLM({
  context: state.executionContext, // Full ExecutionContext
  systemMessage: "System prompt",
  userMessage: state.userMessage,
});
```

### ❌ Modifying ExecutionContext

```typescript
// ❌ WRONG: Modifying ExecutionContext
state.executionContext.userId = "new-user-id";
```

**✅ FIX: ExecutionContext is immutable**
```typescript
// ✅ CORRECT: ExecutionContext flows through unchanged
// Only taskId can be set when first created
```

## LLM Service Violations

### ❌ Not Passing ExecutionContext

```typescript
// ❌ WRONG: Missing ExecutionContext
await llmClient.callLLM({
  systemMessage: "System prompt",
  userMessage: "User message",
  // Missing context!
});
```

**✅ FIX: Always pass ExecutionContext**
```typescript
// ✅ CORRECT: ExecutionContext required
await llmClient.callLLM({
  context: state.executionContext, // REQUIRED
  systemMessage: "System prompt",
  userMessage: "User message",
});
```

### ❌ Not Tracking Caller

```typescript
// ❌ WRONG: Missing caller tracking
await llmClient.callLLM({
  context: state.executionContext,
  systemMessage: "System prompt",
  userMessage: "User message",
  // Missing callerName!
});
```

**✅ FIX: Track caller for analytics**
```typescript
// ✅ CORRECT: Track caller
await llmClient.callLLM({
  context: state.executionContext,
  systemMessage: "System prompt",
  userMessage: "User message",
  callerName: "workflow-name", // Track caller
});
```

## Observability Violations

### ❌ Not Passing ExecutionContext

```typescript
// ❌ WRONG: Missing ExecutionContext
await observability.emit({
  threadId: "thread-id",
  status: "processing",
  message: "Processing",
  // Missing context!
});
```

**✅ FIX: Always pass ExecutionContext**
```typescript
// ✅ CORRECT: ExecutionContext required
await observability.emit({
  context: state.executionContext, // REQUIRED
  threadId: state.executionContext.taskId,
  status: "processing",
  message: "Processing",
});
```

### ❌ Blocking on Observability

```typescript
// ❌ WRONG: Blocking on observability
try {
  await observability.emit(event);
} catch (error) {
  throw error; // WRONG - breaks workflow
}
```

**✅ FIX: Observability is non-blocking**
```typescript
// ✅ CORRECT: Non-blocking (service handles this)
await observability.emit(event);
// Service handles errors internally, doesn't throw
```

## State Violations

### ❌ Not Extending BaseStateAnnotation

```typescript
// ❌ WRONG: Not extending BaseStateAnnotation
export const MyWorkflowStateAnnotation = Annotation.Root({
  userMessage: Annotation<string>({ /* ... */ }),
  // Missing ExecutionContext fields!
});
```

**✅ FIX: Extend BaseStateAnnotation**
```typescript
// ✅ CORRECT: Extend BaseStateAnnotation
export const MyWorkflowStateAnnotation = Annotation.Root({
  ...BaseStateAnnotation.spec, // Includes ExecutionContext
  userMessage: Annotation<string>({ /* ... */ }),
});
```

### ❌ Not Storing ExecutionContext in State

```typescript
// ❌ WRONG: Not storing ExecutionContext
const initialState: Partial<MyWorkflowState> = {
  userMessage: input.userMessage,
  // Missing executionContext!
};
```

**✅ FIX: Store ExecutionContext in state**
```typescript
// ✅ CORRECT: Store ExecutionContext
const initialState: Partial<MyWorkflowState> = {
  executionContext: context, // Store ExecutionContext
  userMessage: input.userMessage,
};
```

## Graph Violations

### ❌ Not Using Checkpointer

```typescript
// ❌ WRONG: No checkpointer
return graph.compile();
```

**✅ FIX: Use checkpointer for state persistence**
```typescript
// ✅ CORRECT: Use checkpointer
return graph.compile({
  checkpointer: checkpointer.getCheckpointer(),
});
```

### ❌ Not Setting Entry Point

```typescript
// ❌ WRONG: No entry point
const graph = new StateGraph(MyWorkflowStateAnnotation);
graph.addNode("start", startNode);
return graph.compile(); // Missing setEntryPoint!
```

**✅ FIX: Set entry point**
```typescript
// ✅ CORRECT: Set entry point
const graph = new StateGraph(MyWorkflowStateAnnotation);
graph.addNode("start", startNode);
graph.setEntryPoint("start");
return graph.compile({
  checkpointer: checkpointer.getCheckpointer(),
});
```

## Node Violations

### ❌ Not Accessing ExecutionContext from State

```typescript
// ❌ WRONG: Not accessing ExecutionContext
async function processNode(state: MyWorkflowState) {
  // Missing ExecutionContext access
  await llmClient.callLLM({ /* ... */ });
}
```

**✅ FIX: Access ExecutionContext from state**
```typescript
// ✅ CORRECT: Access ExecutionContext
async function processNode(state: MyWorkflowState) {
  const ctx = state.executionContext; // Get ExecutionContext
  await llmClient.callLLM({
    context: ctx, // Use ExecutionContext
    // ...
  });
}
```

### ❌ Not Returning Partial State

```typescript
// ❌ WRONG: Returning full state
async function processNode(state: MyWorkflowState): Promise<MyWorkflowState> {
  return {
    ...state,
    result: "result",
  };
}
```

**✅ FIX: Return partial state**
```typescript
// ✅ CORRECT: Return partial state
async function processNode(state: MyWorkflowState): Promise<Partial<MyWorkflowState>> {
  return {
    result: "result",
    status: "completed",
  };
}
```

## Service Violations

### ❌ Not Initializing Graph in onModuleInit

```typescript
// ❌ WRONG: Creating graph in constructor
constructor() {
  this.graph = createMyWorkflowGraph(); // WRONG
}
```

**✅ FIX: Initialize in onModuleInit**
```typescript
// ✅ CORRECT: Initialize in onModuleInit
async onModuleInit() {
  this.graph = createMyWorkflowGraph(
    this.llmClient,
    this.observability,
    this.checkpointer,
  );
}
```

## Related

- **`PATTERNS.md`**: Correct patterns to follow
- **`ARCHITECTURE.md`**: Architecture overview

