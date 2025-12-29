# Observability Integration

LangGraph integrates with the observability service via HTTP client to the API endpoint.

## Overview

LangGraph workflows send observability events through `ObservabilityService`, which makes HTTP requests to the API's `/webhooks/status` endpoint. This provides real-time progress tracking, workflow monitoring, and event streaming to the frontend.

## Observability Endpoint

### Endpoint: `POST /webhooks/status`

**Location**: API app (`apps/api/`)  
**Called From**: LangGraph app (`apps/langgraph/`) via HTTP client

**Request Format**:
```typescript
POST http://localhost:6100/webhooks/status
Content-Type: application/json

{
  context: ExecutionContext; // REQUIRED - full ExecutionContext
  taskId: string; // Required by webhook for routing
  status: string; // Event status
  timestamp: string; // ISO timestamp
  message: string | null; // Human-readable message
  step: string | null; // Current step/phase name
  percent: number | null; // Progress percentage (0-100)
  mode: string; // Usually "build"
  userMessage: string | null; // User message
  data: {
    hook_event_type: string; // Event type
    source_app: "langgraph"; // Source application
    threadId: string; // LangGraph thread ID
    ...metadata; // Additional event data
  };
}
```

**Response**: HTTP 200 (non-blocking, accepts any status)

## ObservabilityService

### Service Location

**File**: `apps/langgraph/src/services/observability.service.ts`

**Purpose**: HTTP client for sending observability events

### Usage Pattern

```typescript
import { ObservabilityService } from "../../services/observability.service";

// In node function
await observability.emit({
  context: state.executionContext, // REQUIRED - full ExecutionContext
  threadId: state.executionContext.taskId,
  status: "started" | "processing" | "completed" | "failed" | "hitl_waiting" | "hitl_resumed" | "tool_calling" | "tool_completed",
  message: "Human-readable message",
  step: "Current step name",
  progress: 50, // 0-100
  metadata: {
    // Additional event data
  },
});
```

### Convenience Methods

```typescript
// Emit started event
await observability.emitStarted(
  context,
  threadId,
  "Workflow started",
);

// Emit progress event
await observability.emitProgress(
  context,
  threadId,
  "Processing step",
  "step-name",
  50, // progress
);

// Emit completed event
await observability.emitCompleted(
  context,
  threadId,
  "Workflow completed",
);

// Emit failed event
await observability.emitFailed(
  context,
  threadId,
  "Workflow failed",
  "Error message",
);
```

## Event Types

### LangGraph Status Types

```typescript
export type LangGraphStatus =
  | "started"
  | "processing"
  | "hitl_waiting"
  | "hitl_resumed"
  | "completed"
  | "failed"
  | "tool_calling"
  | "tool_completed";
```

### Event Type Mapping

```typescript
// Status mapped to hook_event_type
"started" → "langgraph.started"
"processing" → "langgraph.processing"
"hitl_waiting" → "langgraph.hitl_waiting"
"hitl_resumed" → "langgraph.hitl_resumed"
"completed" → "langgraph.completed"
"failed" → "langgraph.failed"
"tool_calling" → "langgraph.tool_calling"
"tool_completed" → "langgraph.tool_completed"
```

## Key Requirements

### ExecutionContext Required

**✅ Always Include ExecutionContext**:
```typescript
// REQUIRED - ExecutionContext must be included
await observability.emit({
  context: state.executionContext, // REQUIRED - full ExecutionContext
  threadId: state.executionContext.taskId,
  status: "processing",
  message: "Processing step",
});
```

**❌ Don't Cherry-Pick Fields**:
```typescript
// WRONG - Don't cherry-pick fields
await observability.emit({
  userId: state.executionContext.userId, // WRONG
  taskId: state.executionContext.taskId, // WRONG
  // ...
});
```

### Non-Blocking

**Pattern**:
```typescript
// Observability failures shouldn't break workflow
// Service handles errors internally
await observability.emit({
  context: state.executionContext,
  threadId: state.executionContext.taskId,
  status: "processing",
  message: "Processing step",
});

// If observability fails, it's logged but doesn't throw
// Workflow continues normally
```

## Event Flow

### Event Pipeline

1. **Event Production**: Node calls `observability.emit()`
2. **HTTP Request**: Service sends POST to `/webhooks/status`
3. **Event Broadcasting**: API service broadcasts to SSE subscribers
4. **Event Persistence**: API service persists to database

### Frontend Integration

**SSE Stream**:
```typescript
// Frontend receives events via SSE
const eventSource = new EventSource(
  '/observability/stream?conversationId=xxx'
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle observability event
};
```

## Configuration

### Environment Variables

**Required**:
```bash
API_PORT=6100  # Port of API server (REQUIRED - no default)
API_HOST=localhost  # Host of API server (default: localhost)
```

**Pattern**:
```typescript
// Service reads from environment
const apiPort = this.configService.get<string>("API_PORT");
if (!apiPort) {
  throw new Error("API_PORT environment variable is required");
}

const apiHost = this.configService.get<string>("API_HOST") || "localhost";
this.apiBaseUrl = `http://${apiHost}:${apiPort}`;
```

## Error Handling

### Non-Blocking Pattern

```typescript
// Service handles errors internally
async emit(event: LangGraphObservabilityEvent): Promise<void> {
  try {
    await firstValueFrom(
      this.httpService.post(url, payload, {
        timeout: 2000, // 2 second timeout
        validateStatus: () => true, // Accept any status
      }),
    );
  } catch (error) {
    // Log but don't throw - observability failures shouldn't break workflow
    this.logger.warn(
      `Failed to send observability event (non-blocking): ${error.message}`
    );
  }
}
```

## Common Violations

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

### ❌ Cherry-Picking ExecutionContext Fields

```typescript
// ❌ WRONG: Cherry-picking fields
await observability.emit({
  userId: state.executionContext.userId, // WRONG
  taskId: state.executionContext.taskId, // WRONG
  // ...
});
```

**✅ FIX: Pass full ExecutionContext**
```typescript
// ✅ CORRECT: Pass full ExecutionContext
await observability.emit({
  context: state.executionContext, // Full ExecutionContext
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

## Related

- **`LLM_SERVICE.md`**: LLM service integration
- **`PATTERNS.md`**: LangGraph patterns
- **`ARCHITECTURE.md`**: Architecture overview

