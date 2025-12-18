# Human-in-the-Loop (HITL) Deep Dive

Comprehensive guide to implementing HITL in LangGraph workflows.

## Overview

HITL allows workflows to pause execution and wait for human input before continuing. This is essential for:
- Content review and approval
- Decision points requiring human judgment
- Quality gates before finalization
- User feedback integration

## Architecture

### Flow Diagram

```
┌─────────────┐
│   Node A    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ HITL Node   │───► interrupt() ───► Graph Pauses
└──────┬──────┘     State Checkpointed
       │
       │ (Human reviews)
       │
       ▼
┌─────────────┐
│ Resume API  │───► Command({ resume }) ───► Graph Resumes
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Routing     │───► Based on decision
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Next Node   │
└─────────────┘
```

## State Structure

### HitlBaseStateAnnotation

All HITL-capable workflows should extend `HitlBaseStateAnnotation`:

```typescript
import { HitlBaseStateAnnotation } from "../../hitl/hitl-base.state";

export const MyAgentStateAnnotation = Annotation.Root({
  ...HitlBaseStateAnnotation.spec, // Includes ExecutionContext + HITL fields
  // Agent-specific fields...
});
```

### HITL Fields

```typescript
// HITL decision from human
hitlDecision: Annotation<HitlDecision | null>({
  reducer: (_, next) => next,
  default: () => null,
}),

// Optional feedback from human
hitlFeedback: Annotation<string | null>({
  reducer: (_, next) => next,
  default: () => null,
}),

// Whether HITL is currently pending
hitlPending: Annotation<boolean>({
  reducer: (_, next) => next,
  default: () => false,
}),

// Which node triggered HITL (for serialized HITL)
hitlNodeName: Annotation<string | null>({
  reducer: (_, next) => next,
  default: () => null,
}),
```

### HitlDecision Type

```typescript
type HitlDecision = "approve" | "skip" | "replace" | "regenerate" | "reject";
```

## Interrupt Node Implementation

### Basic Interrupt Node

```typescript
async function hitlInterruptNode(
  state: MyAgentState,
): Promise<Partial<MyAgentState>> {
  const ctx = state.executionContext;

  // 1. Prepare content for review
  const pendingContent = {
    draft: state.draft,
    metadata: state.metadata,
  };

  // 2. Emit observability BEFORE interrupt
  await observability.emitHitlWaiting(
    ctx,
    ctx.taskId,
    pendingContent,
    "Draft ready for review",
  );

  // 3. Call interrupt() - pauses graph here
  const hitlResponse = interrupt({
    reason: "human_review",
    nodeName: "hitl_interrupt",
    content: pendingContent,
    message: "Please review the draft before finalizing",
  }) as HitlResponse | undefined;

  // 4. Handle response (if undefined, still waiting)
  if (!hitlResponse) {
    return {
      hitlPending: true,
      status: "hitl_waiting",
    };
  }

  // 5. Extract decision and update state
  const { decision, feedback, editedContent } = hitlResponse;

  return {
    hitlPending: false,
    hitlDecision: decision,
    hitlFeedback: feedback || null,
    // Update content if provided
    draft: editedContent?.draft || state.draft,
    status: decision === "reject" ? "rejected" : "processing",
  };
}
```

### Interrupt Behavior

**On Initial Call:**
- `interrupt()` throws `GraphInterrupt` exception
- Graph execution pauses
- State is checkpointed to database
- Service catches `GraphInterrupt` and returns `hitl_waiting` status

**On Resume:**
- `interrupt()` returns the value passed via `Command({ resume: value })`
- Graph execution continues from interrupt point
- State is updated with decision and feedback

## Service Integration

### Handling Interrupt in Service

```typescript
import { Command, isGraphInterrupt } from "@langchain/langgraph";

async function generate(input: MyAgentInput): Promise<MyAgentResult> {
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
    
    // Check if still interrupted (shouldn't happen, but safety check)
    const state = await this.graph.getState(config);
    const isInterrupted = state.next && state.next.length > 0;
    
    return {
      taskId,
      status: isInterrupted ? "hitl_waiting" : result.status,
      result: result.result,
    };
  } catch (error) {
    // Handle GraphInterrupt
    if (isGraphInterrupt(error)) {
      this.logger.log(`Workflow paused at HITL: taskId=${taskId}`);

      // Get current state from checkpoint
      const state = await this.graph.getState(config);
      const values = state.values as MyAgentState;

      return {
        taskId,
        status: "hitl_waiting",
        pendingContent: values.pendingContent,
      };
    }

    // Handle other errors
    throw error;
  }
}
```

### Resuming from Interrupt

```typescript
async function resume(
  taskId: string,
  response: HitlResponse,
): Promise<MyAgentResult> {
  this.logger.log(
    `Resuming from HITL: taskId=${taskId}, decision=${response.decision}`,
  );

  const config = {
    configurable: {
      thread_id: taskId,
    },
  };

  try {
    // Get current state to verify task exists
    const currentState = await this.graph.getState(config);
    if (!currentState.values) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Resume with Command
    const result = await this.graph.invoke(
      new Command({ resume: response }),
      config,
    );

    const values = currentState.values as MyAgentState;
    const duration = Date.now() - values.startedAt;

    return {
      taskId,
      status: result.status,
      result: result.result,
      duration,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `HITL resume failed: taskId=${taskId}, error=${errorMessage}`,
    );

    throw new Error(`Resume failed: ${errorMessage}`);
  }
}
```

## Routing After HITL

### Routing Function

```typescript
function routeAfterHitl(state: MyAgentState): string {
  switch (state.hitlDecision) {
    case "approve":
    case "skip":
      // Continue to next step
      return "continue";
      
    case "replace":
      // Content already updated in state, finalize
      return "finalize";
      
    case "regenerate":
      // Go back to generation step
      return "regenerate";
      
    case "reject":
      // Mark as rejected and finalize
      return "finalize_rejected";
      
    default:
      throw new Error(`Invalid HITL decision: ${state.hitlDecision}`);
  }
}
```

### Graph Routing

```typescript
.addConditionalEdges("hitl_interrupt", routeAfterHitl, {
  continue: "next_step",
  finalize: "finalize",
  regenerate: "regenerate",
  finalize_rejected: "finalize_rejected",
})
```

## HitlResponse Structure

### Type Definition

```typescript
interface HitlResponse {
  decision: "approve" | "skip" | "replace" | "regenerate" | "reject";
  feedback?: string;
  editedContent?: any; // Agent-specific content structure
}
```

### Example Responses

**Approve:**
```typescript
{
  decision: "approve",
}
```

**Approve with Feedback:**
```typescript
{
  decision: "approve",
  feedback: "Looks good, but add more detail in section 3",
}
```

**Replace:**
```typescript
{
  decision: "replace",
  editedContent: {
    draft: "Updated content...",
    metadata: { ... },
  },
}
```

**Regenerate:**
```typescript
{
  decision: "regenerate",
  feedback: "Make it more technical and less marketing-focused",
}
```

**Reject:**
```typescript
{
  decision: "reject",
  feedback: "This doesn't meet our quality standards",
}
```

## Observability Integration

### Emit HITL Events

```typescript
// Before interrupt
await observability.emitHitlWaiting(
  ctx,
  ctx.taskId,
  state.pendingContent,
  "Awaiting human review",
);

// After resume
await observability.emitHitlResumed(
  ctx,
  ctx.taskId,
  state.hitlDecision as "approve" | "edit" | "reject",
  `Human review decision: ${state.hitlDecision}`,
);
```

## Common Patterns

### Single HITL Point

```typescript
// Flow: generate → hitl → finalize
.addEdge("generate", "hitl_interrupt")
.addConditionalEdges("hitl_interrupt", routeAfterHitl)
.addEdge("finalize", END)
```

### Multiple HITL Points

```typescript
// Flow: generate → hitl1 → refine → hitl2 → finalize
.addEdge("generate", "hitl_interrupt_1")
.addConditionalEdges("hitl_interrupt_1", routeAfterHitl1)
.addEdge("refine", "hitl_interrupt_2")
.addConditionalEdges("hitl_interrupt_2", routeAfterHitl2)
.addEdge("finalize", END)
```

### Conditional HITL

```typescript
// Only interrupt if confidence is low
.addConditionalEdges("generate", (state) => {
  if (state.confidence < 0.7) return "hitl_interrupt";
  return "finalize";
})
```

## Best Practices

1. **Always emit observability before interrupt** - Ensures proper event tracking
2. **Use descriptive interrupt messages** - Helps humans understand what to review
3. **Include all necessary content in interrupt** - Don't make humans wait for more data
4. **Handle all decision types** - Ensure routing covers all possible decisions
5. **Update state with edited content** - If user provides replacement content
6. **Validate HitlResponse** - Check decision is valid before routing
7. **Log HITL events** - For debugging and audit trails

## Anti-Patterns

1. **❌ Missing observability** - Always emit `emitHitlWaiting` before interrupt
2. **❌ Not using Command** - Must use `Command({ resume })` to resume
3. **❌ Not handling GraphInterrupt** - Must catch and handle interrupt errors
4. **❌ Missing routing** - Must route based on decision after resume
5. **❌ Not updating state** - Must update state with decision and feedback

