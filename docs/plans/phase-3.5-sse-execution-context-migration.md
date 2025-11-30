# Phase 3.5: SSE ExecutionContext Migration Plan

## Executive Summary

Migrate all SSE (Server-Sent Events) to include the full `ExecutionContext` capsule. The capsule is **passed with every call** - no storage changes needed. When any service emits an SSE event, the caller provides the capsule, and it flows through to the frontend.

**Key Principle**: The capsule is immutable and passed with every call. Services don't store it - they receive it and pass it through.

---

## Target State

Per `apps/transport-types/streaming/sse-events.types.ts`:

```typescript
export interface AgentStreamContext {
  context: ExecutionContext;  // Full capsule - passed with every call
  streamId: string;
  mode: string;
  userMessage: string;
  timestamp: string;
}
```

All SSE events (`AgentStreamChunkData`, `AgentStreamCompleteData`, `AgentStreamErrorData`) extend this and include the full `ExecutionContext`.

---

## Current State Gap Analysis

| Component | Current State | Required Change |
|-----------|---------------|-----------------|
| **Transport Types** | ✅ Correct - requires `context: ExecutionContext` | None |
| **LangGraph** | ✅ Already sends capsule in webhook payload | None (cleanup later) |
| **StreamingService** | ❌ Methods don't accept/emit context | Add context parameter |
| **WebhooksController** | ❌ Ignores context from payload | Extract and pass context |
| **Agent2Agent Controller** | ❌ SSE transformations lack context | Include context in events |
| **Frontend** | ❌ Accesses `event.data.taskId` | Access `event.data.context.taskId` |

---

## Migration Tasks

### Task 1: Update StreamingService Method Signatures

**File:** `apps/api/src/agent2agent/services/streaming.service.ts`

#### 1.1 Update emitProgress()

**Current (line 98-132):**
```typescript
emitProgress(
  taskId: string,
  content: string,
  metadata?: { step?: string; progress?: number; ... },
): void
```

**New:**
```typescript
emitProgress(
  context: ExecutionContext,
  content: string,
  userMessage: string,
  metadata?: { step?: string; progress?: number; ... },
): void {
  const eventPayload: AgentStreamChunkData = {
    context,
    streamId: context.taskId,
    mode: metadata?.mode || 'build',
    userMessage,
    timestamp: new Date().toISOString(),
    chunk: {
      type: 'progress',
      content,
      metadata: metadata || {},
    },
  };

  this.eventEmitter.emit('agent.stream.chunk', eventPayload);
}
```

#### 1.2 Update emitComplete()

**Current (line 138-158):**
```typescript
emitComplete(taskId: string, completionData?: Record<string, unknown>): void
```

**New:**
```typescript
emitComplete(
  context: ExecutionContext,
  userMessage: string,
  mode: string,
): void {
  const eventPayload: AgentStreamCompleteData = {
    context,
    streamId: context.taskId,
    mode,
    userMessage,
    timestamp: new Date().toISOString(),
    type: 'complete',
  };

  this.eventEmitter.emit('agent.stream.complete', eventPayload);
}
```

#### 1.3 Update emitError()

**Current (line 164-186):**
```typescript
emitError(taskId: string, error: string): void
```

**New:**
```typescript
emitError(
  context: ExecutionContext,
  userMessage: string,
  mode: string,
  error: string,
): void {
  const eventPayload: AgentStreamErrorData = {
    context,
    streamId: context.taskId,
    mode,
    userMessage,
    timestamp: new Date().toISOString(),
    type: 'error',
    error,
  };

  this.eventEmitter.emit('agent.stream.error', eventPayload);
}
```

#### 1.4 Add Required Imports

```typescript
import {
  ExecutionContext,
  AgentStreamChunkData,
  AgentStreamCompleteData,
  AgentStreamErrorData,
} from '@orchestrator-ai/transport-types';
```

#### 1.5 Evaluate registerStream() and Stream Registry

The `registerStream()` method and in-memory `streamRegistry` are currently used for:
1. Mapping taskId to stream metadata
2. Looking up metadata when emitting events

**With the new approach**, the context is passed with every call, so the registry may no longer be needed for SSE emission. However, it may still be used for:
- Token validation in `TaskStatusService`
- Stream session tracking

**Action:** Review usages of `getStreamMetadata()` and determine if registry is still needed. If only used for SSE emission, it can be removed. If used for auth/session tracking, keep it but simplify.

---

### Task 2: Update WebhooksController to Pass Context

**File:** `apps/api/src/webhooks/webhooks.controller.ts`

#### 2.1 Update WorkflowStatusUpdate Interface

**Current (line 25-65):**
```typescript
interface WorkflowStatusUpdate {
  taskId: string;
  status: string;
  timestamp: string;
  // ... individual fields
}
```

**New - Add context field:**
```typescript
interface WorkflowStatusUpdate {
  taskId: string;
  status: string;
  timestamp: string;

  // ExecutionContext capsule (from LangGraph and other callers)
  context?: ExecutionContext;

  // User message that triggered the task
  userMessage?: string;

  // Mode (plan, build, converse)
  mode?: string;

  // ... keep existing fields for backward compatibility
}
```

#### 2.2 Update handleStatusUpdate() to Extract and Pass Context

**Current (line 170-181):**
```typescript
this.streamingService.emitProgress(
  update.taskId,
  update.message || stepName,
  { step: stepName, sequence, totalSteps, status, progress },
);
```

**New:**
```typescript
// Use context if provided, otherwise skip SSE emission (or construct minimal context)
if (update.context && isExecutionContext(update.context)) {
  this.streamingService.emitProgress(
    update.context,
    update.message || stepName,
    update.userMessage || '',
    {
      step: stepName,
      sequence,
      totalSteps: totalStepsFromUpdate,
      status: update.status,
      progress,
      mode: update.mode,
    },
  );
}
```

#### 2.3 Add Import

```typescript
import { ExecutionContext, isExecutionContext } from '@orchestrator-ai/transport-types';
```

---

### Task 3: Update All StreamingService Call Sites

Search and update all places that call `emitProgress()`, `emitComplete()`, `emitError()`.

#### 3.1 Find All Call Sites

```bash
grep -rn "streamingService.emit" apps/api/src
grep -rn "this.streamingService.emit" apps/api/src
```

**Expected locations:**
- `apps/api/src/webhooks/webhooks.controller.ts` (Task 2 covers this)
- `apps/api/src/agent2agent/services/base-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/agent-execution-gateway.service.ts`
- Any runner that emits progress events

#### 3.2 Update Each Call Site

Each call must now pass:
- `context: ExecutionContext` (from the request)
- `userMessage: string` (from the request payload)
- `mode: string` (from the request)

**Pattern:**
```typescript
// OLD
this.streamingService.emitProgress(taskId, message, metadata);

// NEW
this.streamingService.emitProgress(context, message, userMessage, metadata);
```

---

### Task 4: Update Agent2Agent Controller SSE Transformations

**File:** `apps/api/src/agent2agent/agent2agent.controller.ts`

The controller transforms internal events to SSE events. With the new approach, events already contain `context`, so transformations just pass it through.

#### 4.1 Update toChunkSseEvent()

**Current (line 1097-1116):**
```typescript
private toChunkSseEvent(event: AgentStreamChunkEvent): AgentStreamChunkSSEEvent {
  return {
    event: 'agent_stream_chunk',
    data: {
      streamId: event.streamId,
      conversationId: event.conversationId,
      organizationSlug: event.organizationSlug ?? null,
      agentSlug: event.agentSlug,
      mode: event.mode,
      timestamp: new Date().toISOString(),
      chunk: { ... },
    },
  };
}
```

**New:**
```typescript
private toChunkSseEvent(event: AgentStreamChunkData): AgentStreamChunkSSEEvent {
  return {
    event: 'agent_stream_chunk',
    data: event,  // Event already has correct shape with context
  };
}
```

#### 4.2 Update toCompleteSseEvent()

**Current (line 1118-1133):**
```typescript
private toCompleteSseEvent(event: AgentStreamCompleteEvent): AgentStreamCompleteSSEEvent {
  return {
    event: 'agent_stream_complete',
    data: {
      streamId: event.streamId,
      // ... individual fields
    },
  };
}
```

**New:**
```typescript
private toCompleteSseEvent(event: AgentStreamCompleteData): AgentStreamCompleteSSEEvent {
  return {
    event: 'agent_stream_complete',
    data: event,  // Event already has correct shape with context
  };
}
```

#### 4.3 Update toErrorSseEvent()

**Current (line 1135-1151):**
```typescript
private toErrorSseEvent(event: AgentStreamErrorEvent): AgentStreamErrorSSEEvent {
  return {
    event: 'agent_stream_error',
    data: {
      streamId: event.streamId,
      // ... individual fields
    },
  };
}
```

**New:**
```typescript
private toErrorSseEvent(event: AgentStreamErrorData): AgentStreamErrorSSEEvent {
  return {
    event: 'agent_stream_error',
    data: event,  // Event already has correct shape with context
  };
}
```

#### 4.4 Update Internal Event Type References

Change internal types to use transport-types:
```typescript
import {
  AgentStreamChunkData,
  AgentStreamCompleteData,
  AgentStreamErrorData,
  AgentStreamChunkSSEEvent,
  AgentStreamCompleteSSEEvent,
  AgentStreamErrorSSEEvent,
} from '@orchestrator-ai/transport-types';
```

Remove local `AgentStreamChunkEvent`, `AgentStreamCompleteEvent`, `AgentStreamErrorEvent` interfaces if they exist.

#### 4.5 Update buildChunkEventFromObservability()

**Current (line 1049-1074):** Builds events from observability_events table records.

**Challenge:** Observability events in the database don't have full ExecutionContext.

**Solution:** For events coming from the observability stream (admin monitoring), we have two options:

**Option A (Recommended):** Skip context for observability-sourced events - they're for admin monitoring, not user-facing SSE.

**Option B:** Construct minimal context from available fields with NIL_UUID for missing values.

```typescript
private buildChunkEventFromObservability(
  event: ObservabilityEventRecord,
): AgentStreamChunkData {
  // Construct minimal context for admin observability events
  const context: ExecutionContext = {
    orgSlug: event.organization_slug || 'global',
    userId: event.user_id || NIL_UUID,
    conversationId: event.conversation_id || NIL_UUID,
    taskId: event.task_id,
    planId: NIL_UUID,
    deliverableId: NIL_UUID,
    agentSlug: event.agent_slug || 'unknown',
    agentType: 'unknown',
    provider: NIL_UUID,
    model: NIL_UUID,
  };

  return {
    context,
    streamId: event.task_id,
    mode: event.mode ?? 'converse',
    userMessage: event.message || '',
    timestamp: new Date(event.timestamp).toISOString(),
    chunk: {
      type: 'progress',
      content: this.resolveObservabilityContent(event),
      metadata: {
        progress: event.progress ?? undefined,
        step: event.step ?? undefined,
        // ... rest of metadata
      },
    },
  };
}
```

---

### Task 5: Update Frontend Event Handlers

**File:** `apps/web/src/services/agent2agent/sse/a2aStreamHandler.ts`

The handler already imports correct types from transport-types. The main change is how consuming code accesses event data.

#### 5.1 Find All Event Data Access Patterns

```bash
grep -rn "\.data\.taskId\|\.data\.conversationId\|\.data\.agentSlug\|\.data\.organizationSlug\|\.data\.streamId" apps/web/src
```

#### 5.2 Update Access Patterns

**Old pattern:**
```typescript
const taskId = event.data.taskId;
const conversationId = event.data.conversationId;
const agentSlug = event.data.agentSlug;
const orgSlug = event.data.organizationSlug;
```

**New pattern:**
```typescript
const taskId = event.data.context.taskId;
const conversationId = event.data.context.conversationId;
const agentSlug = event.data.context.agentSlug;
const orgSlug = event.data.context.orgSlug;

// streamId stays at top level (not in context)
const streamId = event.data.streamId;
```

#### 5.3 Files to Check

- `apps/web/src/services/agent2agent/sse/a2aStreamHandler.ts`
- `apps/web/src/composables/useAdminObservabilityStream.ts`
- Any components that consume SSE events directly
- Any stores that process SSE event data

---

### Task 6: Update LangGraph (Cleanup - Low Priority)

**File:** `apps/langgraph/src/services/observability.service.ts`

LangGraph already sends the full context. After the API migration is verified, remove the backward-compatibility individual fields.

#### 6.1 Simplify emit() Payload

**Current (line 77-98):**
```typescript
const payload = {
  context,  // Full context
  // Duplicate fields for backward compatibility:
  taskId: context.taskId,
  conversationId: context.conversationId,
  userId: context.userId,
  agentSlug: context.agentSlug,
  organizationSlug: context.orgSlug,
  // ... more duplicates
};
```

**New (after API migration verified):**
```typescript
const payload = {
  context,  // Full context - single source of truth
  status: this.mapStatusToEventType(event.status),
  timestamp: new Date().toISOString(),
  userMessage: event.message,
  mode: 'build',  // Or from context/event
  message: event.message,
  step: event.step,
  percent: event.progress,
  data: {
    hook_event_type: this.mapStatusToEventType(event.status),
    source_app: 'langgraph',
    threadId: event.threadId,
    ...event.metadata,
  },
};
```

---

## Migration Order

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Update StreamingService (Task 1)                        │
│ - Change method signatures to accept ExecutionContext           │
│ - Update event payloads to include full context                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Update All Call Sites (Tasks 2 & 3)                     │
│ - WebhooksController extracts and passes context                │
│ - All other callers pass context                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Update Agent2Agent Controller (Task 4)                  │
│ - Simplify SSE transformations (pass through context)           │
│ - Handle observability events appropriately                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Update Frontend (Task 5)                                │
│ - Update event.data.context.* access patterns                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Test End-to-End                                         │
│ - Trigger LangGraph workflow                                    │
│ - Verify SSE events contain full ExecutionContext               │
│ - Verify frontend receives and processes correctly              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: LangGraph Cleanup (Task 6)                              │
│ - Remove backward-compatibility fields                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `apps/api/src/agent2agent/services/streaming.service.ts` | MODIFY | Add context param to emit methods |
| `apps/api/src/webhooks/webhooks.controller.ts` | MODIFY | Extract context, pass to StreamingService |
| `apps/api/src/agent2agent/agent2agent.controller.ts` | MODIFY | Simplify SSE transformations |
| `apps/api/src/agent2agent/services/base-agent-runner.service.ts` | MODIFY | Update emit calls with context |
| `apps/web/src/**/*.ts` | MODIFY | Update event.data.context.* access |
| `apps/langgraph/src/services/observability.service.ts` | MODIFY | Remove compat fields (later) |

---

## Testing Checklist

- [ ] StreamingService compiles with new signatures
- [ ] All call sites updated and compile
- [ ] WebhooksController receives LangGraph events with context
- [ ] SSE events emitted with full ExecutionContext
- [ ] Frontend receives events and can access context fields
- [ ] End-to-end: LangGraph → Webhook → SSE → Frontend works
- [ ] No regressions in existing functionality

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Task 1: StreamingService | 1 hour |
| Task 2: WebhooksController | 30 min |
| Task 3: Other call sites | 1-2 hours |
| Task 4: Agent2Agent Controller | 1 hour |
| Task 5: Frontend | 1-2 hours |
| Task 6: LangGraph cleanup | 30 min |
| Testing | 1-2 hours |

**Total: 6-9 hours**

---

## Key Points

1. **No database changes** - Capsule flows through runtime, not stored
2. **No new storage** - StreamingService receives context with each call
3. **Pass-through pattern** - Services receive context and include it in emitted events
4. **Frontend update** - Access `event.data.context.*` instead of `event.data.*`
5. **LangGraph already correct** - Just needs API to use the context it sends
