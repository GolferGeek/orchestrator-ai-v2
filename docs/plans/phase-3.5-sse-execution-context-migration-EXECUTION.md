# Phase 3.5: SSE ExecutionContext Migration - EXECUTION PLAN

## Overview

Migrate SSE event handling to use ExecutionContext as an **immutable capsule**. The capsule flows through the entire system - created on frontend, mutated only by backend for `taskId`, `deliverableId`, `planId` when first created.

**Current State Analysis:**
- Transport types: DONE - `AgentStreamContext` requires `context: ExecutionContext`
- StreamingService: DONE - Already accepts ExecutionContext in all emit methods
- WebhooksController: DONE - Extracts context and passes to StreamingService
- Agent2Agent Controller SSE transformations: DONE - Pass-through pattern implemented
- Base/Context/RAG Agent Runners: DONE - All emit calls use context
- LangGraph ObservabilityService: MOSTLY DONE - Has duplicate fields for backward compat
- Frontend: NEEDS REVIEW - Check how SSE events are consumed

---

## Task 1: LangGraph ObservabilityService Cleanup

**File:** `apps/langgraph/src/services/observability.service.ts`

**Issue:** Lines 77-98 duplicate context fields for "backward compatibility":
```typescript
const payload = {
  context,  // Full context
  // REMOVE THESE - duplicate fields:
  taskId: context.taskId,
  conversationId: context.conversationId,
  userId: context.userId,
  agentSlug: context.agentSlug,
  organizationSlug: context.orgSlug,
  // ...
};
```

**Action:** Remove all duplicate fields. The context capsule is the single source of truth.

**Decision:** NO BACKWARD COMPATIBILITY. Remove all duplicate fields now.

**New `emit()` payload:**
```typescript
const payload = {
  context,  // Full ExecutionContext - SINGLE SOURCE OF TRUTH
  status: this.mapStatusToEventType(event.status),
  timestamp: new Date().toISOString(),
  userMessage: event.message,
  mode: 'build',
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
// REMOVED: taskId, conversationId, userId, agentSlug, organizationSlug
// These are ALL in context - no duplication
```

---

## Task 2: WebhooksController Legacy Field Cleanup

**File:** `apps/api/src/webhooks/webhooks.controller.ts`

**Decision:** NO BACKWARD COMPATIBILITY. Context is REQUIRED.

**Issue:** Lines 50-54 still define legacy individual fields:
```typescript
// Optional context fields (legacy - use context object instead)
conversationId?: string;
userId?: string;
```

**Issue:** Lines 161, 215, 229, 265-270 still access legacy fields with fallbacks:
```typescript
const userId = update.context?.userId || update.userId;  // REMOVE fallback
const conversationId = update.context?.conversationId || update.conversationId;  // REMOVE
```

**Action:**
1. Remove legacy field definitions from `WorkflowStatusUpdate` interface:
   - Remove `conversationId?: string`
   - Remove `userId?: string`
   - Remove `agentSlug?: string`
   - Remove `organizationSlug?: string`
   - Remove `username?: string` (can derive from userId)
2. Make `context` REQUIRED (not optional) in interface
3. Remove ALL fallback patterns - use `update.context.*` directly
4. Early return if context is missing (reject the webhook)

**Updated Interface:**
```typescript
interface WorkflowStatusUpdate {
  // Required fields
  taskId: string;  // Keep for URL routing/logging only
  status: string;
  timestamp: string;

  // ExecutionContext capsule - REQUIRED
  context: ExecutionContext;

  // User message that triggered the task
  userMessage?: string;

  // Mode (plan, build, converse)
  mode?: string;

  // Optional workflow identification (for n8n/external systems)
  executionId?: string;
  workflowId?: string;
  workflowName?: string;

  // Optional progress fields
  step?: string;
  percent?: number;
  message?: string;
  node?: string;
  stage?: string;
  results?: Record<string, unknown>;

  // Optional sequence tracking
  sequence?: number;
  totalSteps?: number;
  data?: {
    sequence?: number;
    totalSteps?: number;
    [key: string]: unknown;
  };
}
```

**Updated handleStatusUpdate():**
```typescript
// At the start of handleStatusUpdate:
if (!update.context || !isExecutionContext(update.context)) {
  this.logger.warn('Webhook received without valid ExecutionContext - rejecting');
  return;  // Or throw BadRequestException
}

// Then use update.context.* everywhere - no fallbacks
const { userId, conversationId, agentSlug, orgSlug } = update.context;
```

---

## Task 3: ObservabilityEventRecord Type Cleanup

**File:** `apps/api/src/observability/observability-events.service.ts`

**Issue:** The `ObservabilityEventRecord` interface has duplicate fields at lines 8-25:
```typescript
context?: ExecutionContext;  // MAKE REQUIRED
user_id: string | null;      // REDUNDANT - in context
conversation_id: string | null;  // REDUNDANT - in context
task_id: string;             // REDUNDANT - in context
agent_slug: string | null;   // REDUNDANT - in context
organization_slug: string | null;  // REDUNDANT - in context
```

**Action:**
1. Make `context` required (not optional)
2. Keep the flat fields for database storage/querying (necessary for SQL indexes)
3. Document that flat fields are derived from context for persistence

**NOTE:** We keep flat fields for database storage - the DB schema needs them for efficient queries. But `context` should be REQUIRED so SSE events always have the full capsule.

```typescript
export interface ObservabilityEventRecord {
  /** Full ExecutionContext capsule - REQUIRED for SSE streaming */
  context: ExecutionContext;  // REQUIRED, not optional
  // ... rest stay for DB storage
}
```

---

## Task 4: Frontend executionContext.ts - DELETE

**File:** `apps/web/src/utils/executionContext.ts`

**Decision:** DELETE this file. The `useExecutionContextStore` is the single source of truth.

**Rationale:**
- Everything is REQUIRED - we always know all values based on user interaction
- New conversation: user clicked on an agent (we know agentSlug, agentType)
- Existing conversation: hydrated from DB with all context
- The store already handles this correctly

**Usage Found:**
- `apps/web/src/services/agent2agent/api/agent2agent.api.ts` line 40, 97 - uses `buildContext()` wrapper

**Action:**
1. Delete `apps/web/src/utils/executionContext.ts`
2. Update `apps/web/src/services/agent2agent/api/agent2agent.api.ts`:
   - Remove import of `buildExecutionContext`
   - Replace `buildContext()` calls with `useExecutionContextStore().current`
   - Or pass context as parameter if this service is used outside component context

**Updated agent2agent.api.ts pattern:**
```typescript
// BEFORE
import { buildExecutionContext } from '@/utils/executionContext';

private buildContext(conversationId: string, options?: { taskId?: string; deliverableId?: string }): ExecutionContext {
  return buildExecutionContext(conversationId, {
    taskId: options?.taskId,
    deliverableId: options?.deliverableId,
    agentSlug: this.agentSlug,
  });
}

// AFTER - use store directly
import { useExecutionContextStore } from '@/stores/executionContextStore';

// Context comes from store - caller must ensure it's initialized
private getContext(): ExecutionContext {
  return useExecutionContextStore().current;  // Throws if not initialized
}
```

---

## Task 5: Frontend SSE Event Handler Review

**File:** `apps/web/src/services/agent2agent/sse/a2aStreamHandler.ts`

**Current State:** This file is CLEAN - it receives typed events (`AgentStreamChunkSSEEvent['data']`) and passes them through to handlers. The types from transport-types already require `context`.

**No changes needed** - the handler passes the full event data to callbacks. Consumers access `event.context.*`.

---

## Task 6: Frontend useAdminObservabilityStream Review

**File:** `apps/web/src/composables/useAdminObservabilityStream.ts`

**Issue:** The `ObservabilityEvent` interface at lines 5-33 duplicates fields already in ExecutionContext:
```typescript
export interface ObservabilityEvent {
  context?: ExecutionContext;  // SHOULD BE REQUIRED
  task_id?: string;            // REDUNDANT - in context
  taskId?: string;             // REDUNDANT - alternative casing
  conversation_id?: string | null;  // REDUNDANT
  agent_slug?: string | null;  // REDUNDANT
  // ...
}
```

**Issue:** Lines 101-109 access individual fields with fallbacks instead of using context:
```typescript
const eventRecord = event as Record<string, unknown>;
const sessionId = event.session_id || eventRecord.sessionId as string;
const directConvId = event.conversation_id || eventRecord.conversationId as string;
```

**Action:**
1. Make `context` required in interface
2. Update field access to use `event.context.*` as primary, with flat field fallback only for pre-migration events
3. Clean up the mapping logic to prefer context-based access

---

## Task 7: Verify transport-types Exports

**File:** `apps/transport-types/index.ts` (or main export)

**Action:** Ensure `isExecutionContext` type guard is exported so callers can validate context presence:
```typescript
export {
  ExecutionContext,
  isExecutionContext,
  NIL_UUID,
  createExecutionContext,
  createMockExecutionContext
} from './core/execution-context';
```

---

## Task 8: End-to-End Verification

After all changes:

1. **Build Check:**
   ```bash
   npm run build
   ```

2. **Type Check:**
   ```bash
   npx tsc --noEmit -p apps/api
   npx tsc --noEmit -p apps/web
   npx tsc --noEmit -p apps/langgraph
   ```

3. **Test Flow:**
   - Trigger LangGraph workflow
   - Verify webhook receives full context
   - Verify SSE events contain `context: ExecutionContext`
   - Verify frontend receives and can access `event.data.context.*`

4. **Lint:**
   ```bash
   npm run lint
   ```

---

## Migration Order

```
Step 1: Transport-types verification (Task 7)
   └── Ensure exports are complete

Step 2: LangGraph cleanup (Task 1)
   └── Remove duplicate fields from emit payload

Step 3: WebhooksController cleanup (Task 2)
   └── Remove legacy field fallbacks

Step 4: ObservabilityEventRecord type (Task 3)
   └── Make context required

Step 5: Frontend utility cleanup (Task 4)
   └── Delete obsolete executionContext.ts or fix it

Step 6: Frontend composable cleanup (Task 6)
   └── Update useAdminObservabilityStream

Step 7: Verification (Task 8)
   └── Build, type-check, test, lint
```

---

## Files Changed Summary

| File | Change | Description |
|------|--------|-------------|
| `apps/langgraph/src/services/observability.service.ts` | MODIFY | Remove duplicate context fields from payload (no backward compat) |
| `apps/api/src/webhooks/webhooks.controller.ts` | MODIFY | Remove legacy fields, make context REQUIRED, remove all fallbacks |
| `apps/api/src/observability/observability-events.service.ts` | MODIFY | Make context required in interface |
| `apps/web/src/utils/executionContext.ts` | DELETE | Remove obsolete utility - use store instead |
| `apps/web/src/services/agent2agent/api/agent2agent.api.ts` | MODIFY | Remove buildExecutionContext, use store.current |
| `apps/web/src/composables/useAdminObservabilityStream.ts` | MODIFY | Use context.* access pattern, remove fallbacks |
| `apps/transport-types/index.ts` | VERIFY | Already complete - isExecutionContext exported |

---

## Key Principles Enforced

1. **ExecutionContext is a capsule** - never extract individual fields, pass the whole thing
2. **Frontend creates context** - new or hydrated from existing conversation
3. **Backend can only add** - taskId, deliverableId, planId when first created
4. **No fallbacks** - context is required, not optional
5. **No duplicate fields** - the capsule is the single source of truth
6. **Clean pass-through** - services receive context and include it in events unchanged
