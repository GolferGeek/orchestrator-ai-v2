# Observability Patterns

The observability service provides real-time monitoring and event streaming for all agent executions via Server-Sent Events (SSE).

## Observability SSE Streaming

### Endpoint: `GET /observability/stream`

**Purpose**: Real-time monitoring of all agent executions.

**Query Parameters**:
- `userId` - Filter by user ID
- `agentSlug` - Filter by agent
- `conversationId` - Filter by conversation

**Response**: Server-Sent Events stream

**Pattern**:
```typescript
// Frontend or external client
const eventSource = new EventSource(
  '/observability/stream?conversationId=xxx'
);

eventSource.onmessage = (event) => {
  const data: ObservabilityEventRecord = JSON.parse(event.data);
  // Handle observability event
};

eventSource.onerror = (error) => {
  // Handle connection error
};
```

## Event Flow

### Event Pipeline

1. **Event Production**: Services/runners push events to `ObservabilityEventsService.push()`
2. **Event Buffering**: Service maintains in-memory buffer (RxJS Subject)
3. **Event Broadcasting**: Events broadcast to all SSE subscribers
4. **Event Persistence**: Events persisted to database for historical queries

### ObservabilityEventsService

**Purpose**: Central service for observability event management.

**Features**:
- In-memory event buffer (configurable size, default 500)
- RxJS Subject for reactive event streaming
- Username enrichment from cache/database
- Database persistence for historical queries

**Pattern**:
```typescript
import { ObservabilityEventsService } from '@/observability/observability-events.service';

@Injectable()
export class CustomService {
  constructor(
    private readonly observability: ObservabilityEventsService,
  ) {}
  
  async pushEvent(event: ObservabilityEventRecord): Promise<void> {
    await this.observability.push(event);
  }
}
```

## Sending Observability Events

### From API Services

**Pattern**:
```typescript
import { ObservabilityWebhookService } from '@/observability/observability-webhook.service';

@Injectable()
export class CustomService {
  constructor(
    private readonly observability: ObservabilityWebhookService,
  ) {}
  
  async executeTask(context: ExecutionContext): Promise<void> {
    // Send event with ExecutionContext
    await this.observability.sendEvent({
      context, // REQUIRED - full ExecutionContext
      source_app: 'api',
      hook_event_type: 'task.started',
      status: 'running',
      message: 'Task execution started',
      progress: 0,
      step: 'initialization',
      payload: {
        // Additional event data
      },
    });
  }
}
```

### From External APIs (LangGraph, N8N)

**Pattern**:
```typescript
// External API sends event via webhook
await fetch('/webhooks/status', {
  method: 'POST',
  body: JSON.stringify({
    taskId: context.taskId,
    status: 'running',
    context: executionContext, // REQUIRED - full ExecutionContext
    message: 'Workflow step completed',
    progress: 50,
    step: 'processing',
    // Optional workflow identification
    executionId?: string,
    workflowId?: string,
    workflowName?: string,
  }),
});
```

## Event Structure

### ObservabilityEventRecord

**Interface**:
```typescript
interface ObservabilityEventRecord {
  context: ExecutionContext; // REQUIRED - all identity fields
  source_app: string; // 'api', 'langgraph', 'n8n', etc.
  hook_event_type: string; // 'task.started', 'agent.progress', etc.
  status: string; // 'running', 'completed', 'failed', etc.
  message: string | null; // Human-readable message
  progress: number | null; // 0-100
  step: string | null; // Current step/phase name
  payload: Record<string, unknown>; // Additional event data
  timestamp: number; // Unix timestamp (ms)
}
```

### Common Event Types

**LLM Events**:
- `agent.llm.started` - LLM call started
- `agent.llm.completed` - LLM call completed

**Task Events**:
- `task.started` - Task execution started
- `task.completed` - Task execution completed
- `task.failed` - Task execution failed

**Agent Events**:
- `agent.progress` - Agent execution progress update
- `agent.step.completed` - Agent step completed

**LangGraph Events**:
- `langgraph.started` - LangGraph workflow started
- `langgraph.completed` - LangGraph workflow completed
- `langgraph.node.started` - LangGraph node started
- `langgraph.node.completed` - LangGraph node completed

## Key Requirements

### ExecutionContext Required

**✅ Always Include ExecutionContext**:
```typescript
// REQUIRED - ExecutionContext must be included
await observability.sendEvent({
  context: executionContext, // REQUIRED - full ExecutionContext
  source_app: 'api',
  hook_event_type: 'task.started',
  // ...
});
```

**❌ Don't Cherry-Pick Fields**:
```typescript
// WRONG - Don't cherry-pick fields
await observability.sendEvent({
  userId: context.userId, // WRONG
  conversationId: context.conversationId, // WRONG
  // ...
});
```

### Non-Blocking

**Pattern**:
```typescript
// Observability failures shouldn't break execution
try {
  await observability.sendEvent(event);
} catch (error) {
  // Log but don't throw - observability failures are non-blocking
  logger.warn('Failed to send observability event', error);
}
```

## Username Enrichment

**Automatic Enrichment**:
- Username resolved from cache or database
- Cached for performance
- Enriched automatically when event pushed

**Pattern**:
```typescript
// Username automatically enriched
const event: ObservabilityEventRecord = {
  context: executionContext,
  source_app: 'api',
  hook_event_type: 'task.started',
  // ...
};

// Username automatically resolved and added to payload
await observability.push(event);
// event.payload.username is automatically set
```

## Historical Events

### Endpoint: `GET /observability/history`

**Purpose**: Get historical events from database.

**Query Parameters**:
- `since` - Unix timestamp (ms) - defaults to 1 hour ago
- `until` - Unix timestamp (ms) - optional end time
- `limit` - Max events to return (default 1000, max 5000)

**Pattern**:
```typescript
const response = await fetch(
  '/observability/history?since=1234567890&limit=100'
);
const { events, count } = await response.json();
```

## Related

- **`PATTERNS.md`**: API-specific patterns
- **`ARCHITECTURE.md`**: Module/controller/service architecture
- **`LLM_SERVICE.md`**: LLM service patterns

