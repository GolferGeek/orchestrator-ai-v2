# LangGraph Constructs Reference

Comprehensive reference for all LangGraph constructs used in Orchestrator AI workflows.

## Core Imports

```typescript
import {
  StateGraph,      // Main graph builder
  END,             // Terminal node constant
  interrupt,       // HITL interrupt function
  Annotation,      // State annotation builder
  MessagesAnnotation, // Message history annotation
  Command,         // Resume command for HITL
  isGraphInterrupt, // Check if error is interrupt
} from "@langchain/langgraph";

import {
  AIMessage,       // AI message type
  HumanMessage,    // Human message type
  SystemMessage,   // System message type
} from "@langchain/core/messages";
```

## StateGraph

The main graph builder class.

### Creating a Graph

```typescript
const graph = new StateGraph(MyAgentStateAnnotation);
```

### Adding Nodes

```typescript
graph.addNode("node_name", nodeFunction);
```

**Node Function Signature:**
```typescript
async function nodeFunction(
  state: MyAgentState,
): Promise<Partial<MyAgentState>> {
  // Access state
  const ctx = state.executionContext;
  
  // Do work
  const result = await someService.call(ctx);
  
  // Return partial state update
  return {
    result: result.text,
    status: "completed",
  };
}
```

### Adding Edges

**Direct Edge:**
```typescript
graph.addEdge("source_node", "target_node");
```

**Start Edge:**
```typescript
graph.addEdge("__start__", "first_node");
```

**End Edge:**
```typescript
graph.addEdge("final_node", END);
```

### Conditional Edges

**Simple Conditional:**
```typescript
graph.addConditionalEdges(
  "source_node",
  (state) => {
    if (state.error) return "error_node";
    return "next_node";
  },
);
```

**Named Routing Function:**
```typescript
function routeFunction(state: MyAgentState): string {
  switch (state.status) {
    case "error": return "handle_error";
    case "complete": return "finalize";
    default: return "continue";
  }
}

graph.addConditionalEdges("source_node", routeFunction, {
  handle_error: "error_node",
  finalize: "finalize_node",
  continue: "next_node",
});
```

**Multi-Output Conditional:**
```typescript
graph.addConditionalEdges("source_node", (state) => {
  const routes: string[] = [];
  if (state.needsValidation) routes.push("validate");
  if (state.needsEnrichment) routes.push("enrich");
  return routes.length > 0 ? routes : ["finalize"];
});
```

### Compiling Graph

```typescript
const compiledGraph = graph.compile({
  checkpointer: checkpointer.getSaver(),
});
```

## Annotation

State annotation builder for defining state structure.

### Basic Annotation

```typescript
myField: Annotation<string>({
  reducer: (_, next) => next, // Replace with new value
  default: () => "",          // Default value
}),
```

### Reducer Patterns

**Replace (Default):**
```typescript
reducer: (_, next) => next,
```

**Merge Objects:**
```typescript
reducer: (prev, next) => ({ ...prev, ...next }),
```

**Append Arrays:**
```typescript
reducer: (prev, next) => [...prev, ...next],
```

**Accumulate Numbers:**
```typescript
reducer: (prev, next) => (prev || 0) + (next || 0),
```

### State Annotation Root

```typescript
export const MyAgentStateAnnotation = Annotation.Root({
  // Include message history
  ...MessagesAnnotation.spec,
  
  // ExecutionContext
  executionContext: Annotation<ExecutionContext>({
    reducer: (_, next) => next,
    default: () => ({
      orgSlug: "", userId: "", conversationId: "", taskId: "",
      planId: NIL_UUID, deliverableId: NIL_UUID,
      agentSlug: "", agentType: "", provider: "", model: "",
    }),
  }),
  
  // Agent-specific fields
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
});
```

## MessagesAnnotation

Provides message history management.

### Including in State

```typescript
import { MessagesAnnotation } from "@langchain/langgraph";

export const MyAgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec, // Includes messages array
  // Other fields...
});
```

### Using Messages

```typescript
import { AIMessage, HumanMessage } from "@langchain/core/messages";

// Initialize
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
```

## interrupt()

Pauses graph execution for HITL.

### Basic Usage

```typescript
const hitlResponse = interrupt({
  reason: "human_review",
  nodeName: "hitl_interrupt",
  content: state.pendingContent,
  message: "Please review before continuing",
}) as HitlResponse | undefined;
```

### Interrupt Behavior

- **On initial call**: Throws `GraphInterrupt`, checkpoints state
- **On resume**: Returns the value passed via `Command({ resume: value })`

### Handling Interrupt

```typescript
try {
  const result = await graph.invoke(initialState, config);
} catch (error) {
  if (isGraphInterrupt(error)) {
    // Graph paused for HITL
    const state = await graph.getState(config);
    return { status: "hitl_waiting", ... };
  }
}
```

## Command

Resume command for HITL.

### Resuming from Interrupt

```typescript
import { Command } from "@langchain/langgraph";

const result = await graph.invoke(
  new Command({ resume: hitlResponse }),
  { configurable: { thread_id: taskId } },
);
```

### HitlResponse Structure

```typescript
interface HitlResponse {
  decision: "approve" | "skip" | "replace" | "regenerate" | "reject";
  feedback?: string;
  editedContent?: any; // Agent-specific content structure
}
```

## Graph Invocation

### Basic Invocation

```typescript
const result = await graph.invoke(
  initialState,
  {
    configurable: {
      thread_id: context.taskId,
    },
  },
);
```

### Getting State

```typescript
const state = await graph.getState({
  configurable: {
    thread_id: taskId,
  },
});

const values = state.values as MyAgentState;
const isInterrupted = state.next && state.next.length > 0;
```

### Config Structure

```typescript
const config = {
  configurable: {
    thread_id: context.taskId, // Required: Use taskId
  },
  // Optional: tags, metadata, etc.
};
```

## Checkpointer

PostgreSQL-based state persistence.

### Service Setup

```typescript
@Injectable()
export class PostgresCheckpointerService {
  getSaver(): PostgresSaver {
    return this.saver;
  }
}
```

### Graph Compilation

```typescript
return graph.compile({
  checkpointer: checkpointer.getSaver(),
});
```

### Checkpoint Behavior

- State is automatically saved after each node execution
- Enables HITL interrupts and resume
- Allows state recovery after failures
- Supports querying execution history

## Error Handling

### isGraphInterrupt

Check if error is a graph interrupt (HITL).

```typescript
import { isGraphInterrupt } from "@langchain/langgraph";

try {
  await graph.invoke(initialState, config);
} catch (error) {
  if (isGraphInterrupt(error)) {
    // Handle HITL interrupt
  } else {
    // Handle other errors
  }
}
```

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
  );
  
  return {
    status: "failed",
    completedAt: Date.now(),
  };
}
```

## State Reducers

### Replace Reducer (Default)

```typescript
myField: Annotation<string>({
  reducer: (_, next) => next, // New value replaces old
  default: () => "",
}),
```

### Merge Reducer (Objects)

```typescript
metadata: Annotation<Record<string, any>>({
  reducer: (prev, next) => ({ ...prev, ...next }), // Merge objects
  default: () => ({}),
}),
```

### Append Reducer (Arrays)

```typescript
toolResults: Annotation<ToolResult[]>({
  reducer: (prev, next) => [...prev, ...next], // Append to array
  default: () => [],
}),
```

### Accumulate Reducer (Numbers)

```typescript
totalCost: Annotation<number>({
  reducer: (prev, next) => (prev || 0) + (next || 0), // Sum values
  default: () => 0,
}),
```

## Best Practices

1. **Always use checkpointer** - Required for HITL and state persistence
2. **Use taskId as thread_id** - Ensures correct state isolation
3. **Include MessagesAnnotation** - Enables message history
4. **Handle GraphInterrupt** - Required for HITL workflows
5. **Use ExecutionContext** - Never construct or cherry-pick fields
6. **Emit observability** - At all key workflow points
7. **Include error handling** - Always have error nodes and routing

