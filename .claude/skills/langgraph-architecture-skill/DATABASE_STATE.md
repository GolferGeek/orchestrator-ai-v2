# Database-Driven State for Complex Flows

For complex workflows that require persistent state, multi-phase execution, or complex state transitions, LangGraph can use a **database-driven state machine** pattern instead of (or in addition to) the standard LangGraph StateGraph with in-memory state.

## Overview

**Standard LangGraph Pattern:**
- Uses `StateGraph` with in-memory state
- State persisted via Postgres checkpointer
- State flows through graph nodes
- Suitable for simpler workflows

**Database-Driven State Pattern:**
- Database tables ARE the state machine
- No LangGraph StateGraph (or minimal graph)
- Service layer reads/writes to database
- State transitions are database updates
- Suitable for complex, multi-phase workflows

## When to Use Database-Driven State

**✅ Use Database-Driven State When:**
- Complex multi-phase execution (e.g., writing → editing → evaluation → ranking)
- Multiple parallel tracks (e.g., multiple writers, editors, evaluators)
- Long-running workflows that need to survive restarts
- Complex state relationships (e.g., outputs, versions, evaluations, rankings)
- Need to query state from multiple sources (API, LangGraph, frontend)
- Need to restore state when user returns to conversation

**✅ Use Standard LangGraph StateGraph When:**
- Simple sequential workflows
- State fits in memory
- Standard checkpointing is sufficient
- No complex state relationships

## Architecture Pattern

### Service Layer Pattern

**Database Service:**
```typescript
@Injectable()
export class MyWorkflowDbService {
  private readonly supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:6010";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: "my_workflow" }, // Dedicated schema
    });
  }

  // State read operations
  async getTaskConfig(taskId: string): Promise<TaskConfig | null> {
    const { data } = await this.supabase
      .from("workflow_tasks")
      .select("config")
      .eq("task_id", taskId)
      .single();
    return data?.config || null;
  }

  // State write operations
  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    await this.supabase
      .from("workflow_tasks")
      .update({ status })
      .eq("task_id", taskId);
  }
}
```

**Processor Service:**
```typescript
@Injectable()
export class MyWorkflowProcessorService {
  constructor(
    private readonly db: MyWorkflowDbService,
    private readonly observability: ObservabilityService,
    private readonly llmClient: LLMHttpClientService,
  ) {}

  /**
   * Main processing loop - database-driven state machine
   */
  async processTask(taskId: string, context: ExecutionContext): Promise<void> {
    // Read state from database
    const config = await this.db.getTaskConfig(taskId);
    if (!config) {
      throw new Error("Task config not found");
    }

    // Update state in database
    await this.db.updateTaskStatus(taskId, "running");

    // Emit observability event
    await this.observability.emitStarted(context, taskId, "Workflow started");

    // Phase 1: Build initial state
    await this.emitPhaseChange(context, taskId, "phase_1");
    await this.db.buildInitialState(taskId, config);

    // Phase 2: Process
    await this.emitPhaseChange(context, taskId, "phase_2");
    await this.processPhase2(taskId, context, config);

    // Phase 3: Finalize
    await this.emitPhaseChange(context, taskId, "phase_3");
    await this.processPhase3(taskId, context, config);

    // Complete
    await this.db.updateTaskStatus(taskId, "completed");
    await this.observability.emitCompleted(context, taskId, "Workflow completed");
  }
}
```

## Database Schema Pattern

### Dedicated Schema

**Pattern:**
- Use dedicated schema for workflow state (e.g., `marketing`, `my_workflow`)
- Separate from public schema (conversations, tasks, deliverables)
- Schema contains all workflow-specific state tables

**Example Schema Structure:**
```sql
-- Workflow tasks (main state)
CREATE TABLE my_workflow.workflow_tasks (
  task_id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Workflow outputs (content, results)
CREATE TABLE my_workflow.outputs (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES my_workflow.workflow_tasks(task_id),
  status TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Workflow evaluations (scores, rankings)
CREATE TABLE my_workflow.evaluations (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES my_workflow.workflow_tasks(task_id),
  output_id UUID NOT NULL REFERENCES my_workflow.outputs(id),
  score NUMERIC,
  rank INTEGER,
  reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
```

## State Machine Flow

### State Transitions

**Pattern:**
- State transitions are database updates
- Service reads current state from database
- Service updates state in database
- Observability events notify frontend of state changes

**Example Flow:**
```
1. Create task → my_workflow.workflow_tasks (status: 'pending')
2. Initialize → my_workflow.outputs (status: 'pending')
3. Process → my_workflow.outputs (status: 'processing', content: '...')
4. Evaluate → my_workflow.evaluations (score: N, rank: M)
5. Complete → my_workflow.workflow_tasks (status: 'completed')
```

### Phase Management

**Pattern:**
```typescript
async processTask(taskId: string, context: ExecutionContext): Promise<void> {
  // Phase 1
  await this.emitPhaseChange(context, taskId, "phase_1");
  await this.db.updateTaskPhase(taskId, "phase_1");
  await this.processPhase1(taskId, context);

  // Phase 2
  await this.emitPhaseChange(context, taskId, "phase_2");
  await this.db.updateTaskPhase(taskId, "phase_2");
  await this.processPhase2(taskId, context);

  // Phase 3
  await this.emitPhaseChange(context, taskId, "phase_3");
  await this.db.updateTaskPhase(taskId, "phase_3");
  await this.processPhase3(taskId, context);

  // Complete
  await this.db.updateTaskStatus(taskId, "completed");
  await this.observability.emitCompleted(context, taskId, "Workflow completed");
}
```

## Observability Integration

### Fat SSE Messages

**Pattern:**
- Include full row data in SSE events (not just IDs)
- Frontend can update UI without additional API calls
- Reduces latency and API load

**Example:**
```typescript
// Emit event with full output data
await this.observability.emitProgress(context, taskId, "Output updated", {
  metadata: {
    type: "output_updated",
    taskId,
    output: {
      id: output.id,
      status: output.status,
      content: output.content,
      // ... full output row data
    },
  },
});
```

### Event Types

**Common Event Types:**
- `phase_changed` - Phase transition
- `output_updated` - Output status/content changed (full output row)
- `evaluation_updated` - Evaluation completed (full evaluation row)
- `state_updated` - General state update

## ExecutionContext Flow

### ExecutionContext in Database State

**Pattern:**
- ExecutionContext stored in task config or separate field
- ExecutionContext passed to all database operations
- ExecutionContext used for observability and LLM calls

**Example:**
```typescript
// Store ExecutionContext in task config
await this.db.createTask(taskId, {
  config: {
    executionContext: context, // Store ExecutionContext
    // ... other config
  },
});

// Use ExecutionContext from config
const config = await this.db.getTaskConfig(taskId);
const context = config.executionContext; // Retrieve ExecutionContext

// Use ExecutionContext for observability
await this.observability.emit({
  context: context, // Use ExecutionContext
  threadId: context.taskId,
  status: "processing",
});
```

## State Restoration

### Restoring State on Return

**Pattern:**
- Query database to restore full state
- Reconnect to SSE if task still running
- Populate store with state before rendering UI

**Example:**
```typescript
// Get task state from database
async getTaskState(taskId: string): Promise<WorkflowState> {
  const task = await this.db.getTask(taskId);
  const outputs = await this.db.getAllOutputs(taskId);
  const evaluations = await this.db.getAllEvaluations(taskId);

  return {
    task,
    outputs,
    evaluations,
    phase: task.phase,
    status: task.status,
  };
}
```

## Dual Data Sources

### API vs LangGraph

**Pattern:**
- API manages conversation/task metadata (public schema)
- LangGraph manages execution state (workflow schema)
- Frontend queries both to get complete picture

**Example:**
```typescript
// API endpoint (public schema)
GET /tasks/:taskId
// Returns: task metadata, conversation info

// LangGraph endpoint (workflow schema)
GET /workflows/my-workflow/state/:taskId
// Returns: execution state, outputs, evaluations
```

## Common Patterns

### Parallel Processing

**Pattern:**
```typescript
// Build execution queue
const queue = await this.db.buildExecutionQueue(taskId, config);

// Process in parallel (with concurrency limits)
const results = await Promise.all(
  queue.map(item => this.processQueueItem(item, context))
);

// Update state in database
await this.db.updateOutputs(results);
```

### Iterative Processing

**Pattern:**
```typescript
// Process with cycles
for (let cycle = 1; cycle <= maxCycles; cycle++) {
  await this.db.updateCycle(taskId, cycle);
  
  const items = await this.db.getItemsForCycle(taskId, cycle);
  await this.processCycle(items, context);
  
  if (await this.shouldStop(taskId)) {
    break;
  }
}
```

### State Queries

**Pattern:**
```typescript
// Query state for UI
async getStateForUI(taskId: string): Promise<UIState> {
  const task = await this.db.getTask(taskId);
  const outputs = await this.db.getOutputsByStatus(taskId, "completed");
  const evaluations = await this.db.getEvaluationsByStage(taskId, "final");
  
  return {
    task,
    outputs,
    evaluations,
    progress: this.calculateProgress(task, outputs),
  };
}
```

## Violations

### ❌ Mixing In-Memory and Database State

```typescript
// ❌ WRONG: Mixing state sources
const state = await graph.invoke(initialState); // In-memory
await this.db.updateState(state); // Database
// State can get out of sync
```

**✅ FIX: Use database as single source of truth**
```typescript
// ✅ CORRECT: Database is source of truth
const state = await this.db.getState(taskId); // Database
await this.processState(state); // Process
await this.db.updateState(state); // Update database
```

### ❌ Not Passing ExecutionContext

```typescript
// ❌ WRONG: Missing ExecutionContext
await this.db.updateTaskStatus(taskId, "running");
```

**✅ FIX: Pass ExecutionContext**
```typescript
// ✅ CORRECT: ExecutionContext required
const config = await this.db.getTaskConfig(taskId);
const context = config.executionContext;
await this.observability.emit({
  context: context,
  threadId: context.taskId,
  status: "processing",
});
```

## Related

- **`ARCHITECTURE.md`**: Standard LangGraph architecture
- **`PATTERNS.md`**: LangGraph patterns
- **`OBSERVABILITY.md`**: Observability integration
- `.claude/docs/marketing-swarm-conversation-window.md` - Reference implementation

