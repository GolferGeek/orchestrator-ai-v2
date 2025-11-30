# PRD: Unified A2A Orchestrator

## Executive Summary

Consolidate all frontend A2A (Agent-to-Agent) calls into a single orchestrator that uses transport types as the source of truth for both outbound requests and inbound response handling. This eliminates fragmented code paths and ensures consistent behavior across all mode × action combinations.

## Problem Statement

### Current State
The frontend has multiple entry points for A2A calls:
1. `Agent2AgentApi` - Strict typed calls (plan.*, deliverables.*)
2. `tasksService.createAgentTask()` - Legacy method-based calls
3. `hitlService` - Direct JSON-RPC calls bypassing builders
4. `approvalsService` - Different endpoint entirely
5. `agentExecutionService` - Legacy fallback

Response handling is equally fragmented:
- `plan.actions.ts` handles plan responses inline
- `build.actions.ts` handles build responses + HITL detection inline
- `converse.actions.ts` handles converse responses inline
- `handleHitlDecision()` in ConversationView handles HITL responses separately
- Each handler has its own store update logic

### Pain Points
1. **HITL approval bug** - Modal calls hitlService directly, response doesn't update stores properly
2. **No single source of truth** - Business logic scattered across 6+ files
3. **Inconsistent error handling** - Each path handles errors differently
4. **Hard to add new modes** - Would need to update multiple files
5. **Transport types underutilized** - Designed for this but not fully leveraged

## Solution: Transport-Driven Orchestrator

### Core Principle
**The transport type determines everything.** Both the request switch (what to send) and the response switch (what to do with result) are driven entirely by the transport mode and action.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Action / Trigger                        │
│  (click Build, approve HITL, send message, rerun plan, etc.)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  REQUEST ORCHESTRATOR                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  switch (trigger) {                                        │ │
│  │    case 'new_plan':       → buildRequest(PLAN, 'create')  │ │
│  │    case 'new_build':      → buildRequest(BUILD, 'create') │ │
│  │    case 'send_message':   → buildRequest(CONVERSE, null)  │ │
│  │    case 'hitl_approve':   → buildRequest(HITL, 'resume')  │ │
│  │    case 'hitl_regenerate':→ buildRequest(HITL, 'resume')  │ │
│  │    case 'rerun_plan':     → buildRequest(PLAN, 'rerun')   │ │
│  │    case 'rerun_build':    → buildRequest(BUILD, 'rerun')  │ │
│  │    ...                                                     │ │
│  │  }                                                         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     A2A API CALL                                │
│         POST /agent-to-agent/{org}/{agent}/tasks               │
│                    (JSON-RPC 2.0)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RESPONSE ORCHESTRATOR                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  switch (response.mode) {                                  │ │
│  │    case 'plan':                                            │ │
│  │      → validatePlanResponse()                              │ │
│  │      → planStore.addPlan() / addVersion() / etc.          │ │
│  │      → return { type: 'plan', data }                       │ │
│  │                                                            │ │
│  │    case 'build':                                           │ │
│  │      → validateBuildResponse()                             │ │
│  │      → deliverablesStore.addDeliverable() / addVersion()  │ │
│  │      → return { type: 'deliverable', data }                │ │
│  │                                                            │ │
│  │    case 'converse':                                        │ │
│  │      → validateConverseResponse()                          │ │
│  │      → conversationsStore.addMessage()                     │ │
│  │      → return { type: 'message', data }                    │ │
│  │                                                            │ │
│  │    case 'hitl':                                            │ │
│  │      if (status === 'hitl_waiting')                        │ │
│  │        → return { type: 'hitl_waiting', data }             │ │
│  │      if (status === 'completed')                           │ │
│  │        → fetch deliverable                                 │ │
│  │        → deliverablesStore.addDeliverable()                │ │
│  │        → return { type: 'deliverable', data }              │ │
│  │  }                                                         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      UI REACTION                                │
│  switch (result.type) {                                        │
│    case 'deliverable': → open DeliverablesModal                │
│    case 'plan':        → update plan display                   │
│    case 'message':     → scroll to bottom                      │
│    case 'hitl_waiting':→ open HitlReviewModal                  │
│    case 'error':       → show error toast                      │
│  }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Transport Type Matrix

### All Mode × Action Combinations

| Mode | Action | Trigger | Request Payload | Response Content |
|------|--------|---------|-----------------|------------------|
| **PLAN** | create | User clicks Plan | PlanCreatePayload | PlanCreateResponseContent |
| **PLAN** | read | Load plan | PlanReadPayload | PlanReadResponseContent |
| **PLAN** | list | List versions | PlanListPayload | PlanListResponseContent |
| **PLAN** | edit | User edits | PlanEditPayload | (version update) |
| **PLAN** | rerun | Rerun with LLM | PlanRerunPayload | PlanRerunResponseContent |
| **PLAN** | set_current | Select version | PlanSetCurrentPayload | success |
| **PLAN** | delete_version | Delete version | PlanDeleteVersionPayload | success |
| **PLAN** | merge_versions | Merge versions | PlanMergeVersionsPayload | PlanMergeResponseContent |
| **PLAN** | copy_version | Copy version | PlanCopyVersionPayload | PlanCopyResponseContent |
| **PLAN** | delete | Delete plan | PlanDeletePayload | success |
| **BUILD** | create | User clicks Build | BuildCreatePayload | BuildCreateResponseContent |
| **BUILD** | read | Load deliverable | BuildReadPayload | BuildReadResponseContent |
| **BUILD** | list | List deliverables | BuildListPayload | BuildListResponseContent |
| **BUILD** | edit | User edits | BuildEditPayload | (version update) |
| **BUILD** | rerun | Rerun with LLM | BuildRerunPayload | BuildRerunResponseContent |
| **BUILD** | set_current | Select version | BuildSetCurrentPayload | success |
| **BUILD** | delete_version | Delete version | BuildDeleteVersionPayload | success |
| **BUILD** | merge_versions | Merge versions | BuildMergeVersionsPayload | BuildMergeResponseContent |
| **BUILD** | copy_version | Copy version | BuildCopyVersionPayload | BuildCopyResponseContent |
| **BUILD** | delete | Delete deliverable | BuildDeletePayload | success |
| **CONVERSE** | (none) | User sends message | ConverseModePayload | ConverseResponseContent |
| **HITL** | resume | Approve/Reject/etc | HitlResumePayload | HitlDeliverableResponse |
| **HITL** | status | Check status | HitlStatusPayload | HitlStatusResponse |
| **HITL** | history | Get history | HitlHistoryPayload | HitlHistoryResponse |
| **HITL** | pending | Get all pending | HitlPendingPayload | HitlPendingListResponse |

### Response Mode Can Differ From Request Mode

**Critical insight:** When you send a BUILD request, you might get back an HITL response (if the workflow paused for review). The response orchestrator must handle this:

| Request Mode | Possible Response Modes |
|--------------|------------------------|
| PLAN | PLAN |
| BUILD | BUILD, HITL (hitl_waiting) |
| CONVERSE | CONVERSE |
| HITL | HITL (hitl_waiting), BUILD (completed) |

## Implementation

### ExecutionContext: The Universal Capsule

The `ExecutionContext` is an **immutable capsule** that flows through the entire system. The key principle:

> **If any function needs ANY field from the capsule, pass the ENTIRE capsule.**

This eliminates the problem of "I need userId here, but now I also need conversationId and it's not available." The capsule goes everywhere - frontend, backend, LangGraph, LLM calls, observability - as a single unit.

```
Frontend (Store) → API Request (capsule in request) → Gateway → Runner → Service → LangGraph → LLM
    ↑                                                                                        ↓
    └──────────────────── capsule flows through entire stack (isolated per request) ←────────┘
```

**Important:** Each request has its own isolated capsule. Multiple concurrent requests from different users each carry their own context, ensuring no cross-contamination.

#### Core Principles

1. **Pass the whole capsule** - Never pass individual fields; pass the capsule
2. **Almost never mutated** - Only 3 mutation points in the entire system
3. **Read everywhere** - Any code that needs userId, conversationId, etc. receives the capsule
4. **Isolated per request (backend)** - Each request carries its own capsule, ensuring concurrent user isolation
5. **Stored in LangGraph** - The capsule is persisted in the graph state (per request)
6. **Returned to frontend** - Every response includes the capsule (frontend updates store)

#### The Only Mutations (Ever)

The capsule is created once and mutated exactly **twice** after that:

| Mutation | When | Who | What Changes |
|----------|------|-----|--------------|
| **Create** | Conversation selected | Frontend | All fields set (planId, deliverableId, taskId = NIL_UUID) |
| **Add planId** | First plan created | Backend | `planId` set once, never changes again |
| **Add deliverableId** | First deliverable created | Backend | `deliverableId` set once, never changes again |

That's it. After a plan and deliverable exist, the capsule is completely stable.

**Note on `taskId`:** Currently, each conversation has a single task (one-to-one relationship). While the system could theoretically support multiple tasks per conversation in the future, the current architecture assumes one task per conversation. The `taskId` is set when the conversation is initialized and remains stable for that conversation's lifetime.

The `provider` and `model` can be changed by the frontend for "rerun with different LLM" scenarios, but this is a user action, not a system mutation.

#### ExecutionContext Interface

```typescript
// apps/transport-types/core/execution-context.ts

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export interface ExecutionContext {
  // Identity & Routing (set once on conversation select)
  orgSlug: string;
  userId: string;
  conversationId: string;
  agentSlug: string;
  agentType: string;

  // Entity IDs (NIL_UUID until created, then stable forever)
  taskId: string;        // Per-conversation (currently 1:1, but could be 1:many in future)
  planId: string;        // Set once when plan created
  deliverableId: string; // Set once when deliverable created

  // LLM Configuration (can be changed for rerun scenarios)
  provider: string;
  model: string;
}
```

#### Version IDs Are NOT in Context

Version IDs (`versionId`, `versionIds`) are **action-specific** and go in the payload:

```typescript
// Read a specific version - versionId in payload
a2aOrchestrator.execute('plan.read', { versionId: 'abc-123' });

// Merge versions - versionIds in payload
a2aOrchestrator.execute('plan.merge_versions', {
  versionIds: ['abc-123', 'def-456'],
  mergePrompt: 'Combine these...'
});

// Create new - no versionId needed
a2aOrchestrator.execute('plan.create', { userMessage: '...' });
```

#### Where the Capsule Goes

**Rule: If code needs ANY field, it receives the entire capsule.**

| Layer | Receives Capsule | Uses For |
|-------|------------------|----------|
| Frontend Store | ✓ | Sending with requests |
| API Controller | ✓ | Request validation, task creation |
| Execution Gateway | ✓ | Agent lookup, mode routing |
| Runner | ✓ | LLM calls, service calls |
| PlansService | ✓ | DB queries (conversationId, userId) |
| DeliverablesService | ✓ | DB queries (conversationId, userId) |
| LangGraph State | ✓ | Stored in graph, passed to nodes |
| LLM Service | ✓ | Logging, token tracking |
| Observability | ✓ | Tracing, swim lanes |

### Frontend ExecutionContext Store

```typescript
// apps/web/src/stores/executionContextStore.ts

import { defineStore } from 'pinia';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import { NIL_UUID } from '@orchestrator-ai/transport-types';

export const useExecutionContextStore = defineStore('executionContext', {
  state: (): { context: ExecutionContext | null } => ({
    context: null,
  }),

  getters: {
    /** Get current context - throws if not initialized */
    current(): ExecutionContext {
      if (!this.context) {
        throw new Error('ExecutionContext not initialized. Select a conversation first.');
      }
      return this.context;
    },

    /** Check if context is initialized */
    isInitialized(): boolean {
      return this.context !== null;
    },
  },

  actions: {
    /**
     * Create the capsule when conversation is selected.
     * This is the ONLY place the capsule is created on the frontend.
     */
    initialize(params: {
      orgSlug: string;
      userId: string;
      conversationId: string;
      agentSlug: string;
      agentType: string;
      provider: string;
      model: string;
    }) {
      this.context = {
        ...params,
        taskId: NIL_UUID,
        planId: NIL_UUID,
        deliverableId: NIL_UUID,
      };
    },

    /**
     * Replace capsule with one returned from API.
     * Called after EVERY API response - backend may have added planId or deliverableId.
     * 
     * This is the ONLY way the context changes after initialization (besides setLLM).
     * The orchestrator never mutates context - it only reads from store and updates after response.
     */
    update(ctx: ExecutionContext) {
      this.context = ctx;
    },

    /**
     * Change LLM for "rerun with different model" scenarios.
     * This is the ONLY user-initiated mutation of the context.
     * 
     * All other mutations come from backend responses (planId/deliverableId).
     */
    setLLM(provider: string, model: string) {
      if (this.context) {
        this.context = { ...this.context, provider, model };
      }
    },

    /** Clear when leaving conversation */
    clear() {
      this.context = null;
    },
  },
});
```

#### Lifecycle

```typescript
// 1. User selects conversation → capsule created
executionContextStore.initialize({
  orgSlug: 'acme',
  userId: 'user-123',
  conversationId: 'conv-456',
  agentSlug: 'blog-writer',
  agentType: 'context',
  provider: 'Ollama',
  model: 'GPT-OSS:20B',
});
// Capsule: { ..., planId: NIL_UUID, deliverableId: NIL_UUID }

// 2. User creates plan → orchestrator gets context from store, backend adds planId
const result = await a2aOrchestrator.execute('plan.create', { userMessage: '...' });
// Orchestrator automatically:
//   - Gets context from store (executionContextStore.current)
//   - Sends request with context
//   - Response includes: { context: { ..., planId: 'plan-789', deliverableId: NIL_UUID } }
//   - Automatically updates store with returned context (in handleA2AResponse)

// 3. User creates deliverable → orchestrator uses updated context from store
const result = await a2aOrchestrator.execute('build.create', { userMessage: '...' });
// Response includes: { context: { ..., planId: 'plan-789', deliverableId: 'del-012' } }
// Store automatically updated again

// 4. All subsequent calls use the stable capsule from store
// planId and deliverableId never change again for this conversation
```

#### ExecutionContext Initialization Lifecycle

**When ExecutionContext is Created:**

1. **New Conversation** - When user starts a new conversation:
   ```typescript
   const newContext = createExecutionContext({
     orgSlug: currentOrg.value,
     userId: currentUser.value.id,
     conversationId: newConversationId,
     agentSlug: selectedAgent.value,
     agentType: selectedAgentType.value,
     taskId: NIL_UUID,        // No task yet
     planId: NIL_UUID,        // No plan yet
     deliverableId: NIL_UUID, // No deliverable yet
     provider: userSettings.provider,
     model: userSettings.model,
   });
   executionContextStore.set(newContext);
   ```

2. **Existing Conversation Selected** - When user selects an existing conversation:
   ```typescript
   // Fetch the conversation's context from backend or reconstruct from stored data
   const existingContext = await conversationsService.getContext(conversationId);
   executionContextStore.set(existingContext);
   ```

**When ExecutionContext is Updated:**

- **After every A2A response** - `handleA2AResponse()` updates the store with `response.context`
- **When user changes LLM settings** - `executionContextStore.setLLM(provider, model)`
- **Never directly by components** - Components read from store, response handler writes to it

**Store Persistence:**

- Store is in-memory (Pinia) and persists for the browser session
- On page refresh, context is lost and must be re-initialized from conversation selection
- Consider localStorage persistence for better UX (optional enhancement)

#### Usage Pattern: Store-First Approach

**Key Principle:** The ExecutionContext store is the single source of truth in the UI layer.

**For API Calls:**
- Orchestrator NEVER accepts context as parameter
- All functions get context from store internally when needed
- After every response, store is automatically updated with returned context
- **No need to pass context around** - each function goes to the store

**For UI Components:**
- **Use the store directly** - no prop drilling needed
- Components can reactively access: `const ctx = executionContextStore.current`
- Store updates trigger reactive updates automatically
- **No need to pass context as props** - just use the store

**Example Component Usage:**

```typescript
// ✅ GOOD: Use store directly
<script setup lang="ts">
import { a2aOrchestrator } from '@/services/agent2agent/orchestrator';
import { useExecutionContextStore } from '@/stores/executionContextStore';

const executionContextStore = useExecutionContextStore();

async function handleCreatePlan() {
  // Orchestrator always gets context from store - no parameter needed
  const result = await a2aOrchestrator.execute('plan.create', {
    userMessage: 'Create a plan for...'
  });
  
  // Store is automatically updated with returned context
  // If you need the updated context:
  const updatedCtx = executionContextStore.current; // Now has planId!
}

// Access context reactively in template
const currentPlanId = computed(() => executionContextStore.current?.planId);
</script>

// ❌ BAD: Trying to pass context (not even possible - orchestrator doesn't accept it)
<script setup lang="ts">
// Don't try to pass context - orchestrator always uses the store
const result = await a2aOrchestrator.execute('plan.create', {...});
</script>
```

#### API Response Shape

Every response includes the capsule:

```typescript
interface TaskResponse {
  success: boolean;
  mode: string;
  context: ExecutionContext;  // Always returned
  payload: {
    content: unknown;
    metadata: unknown;
  };
}
```

#### Backend: Pass Through, Don't Rebuild

**Critical:** The backend receives the capsule with **each request**. This ensures:
- **Concurrent request isolation**: Multiple users can hit the system simultaneously
- **Same user, multiple sessions**: Even the same user from different browsers/tabs has isolated contexts
- **No shared state**: Each request has its own isolated context capsule - no cross-contamination
- **Stateless processing**: Backend doesn't maintain context state - it flows with the request
- **Horizontal scaling**: Works perfectly with load balancers and multiple server instances
- **Protected execution path**: Each request has its own protected path through the system

**Why This Works:**
- Each HTTP request carries its own ExecutionContext in the request body
- The context flows through: Controller → Gateway → Runner → Service → LangGraph → LLM
- No shared mutable state means no race conditions or data leakage between requests
- Even if User A and User B hit the same endpoint simultaneously, their contexts never mix
- Even if the same user opens two browser tabs, each tab's requests have separate contexts

The backend receives the capsule and passes it through unchanged. It only mutates to add `planId` or `deliverableId` when those are first created:

```typescript
// Backend controller - receives context with each request
async executeTask(request: TaskRequest) {
  // CRITICAL: Validate context at API boundary - must be present and valid
  if (!request.context || !isExecutionContext(request.context)) {
    throw new BadRequestException('ExecutionContext is required and must be valid');
  }

  // Context comes from frontend with the request - each request has its own capsule
  // This context is isolated to THIS request only - never shared with other requests
  let ctx = request.context;  // Isolated per request, no shared state

  // Pass context through entire call stack - every function receives the full capsule
  const result = await this.gateway.execute(ctx, request);

  // Only mutation: add planId if this operation created a plan
  if (result.planCreated && isNilUuid(ctx.planId)) {
    ctx = { ...ctx, planId: result.planId };
  }

  // Only mutation: add deliverableId if this operation created a deliverable
  if (result.deliverableCreated && isNilUuid(ctx.deliverableId)) {
    ctx = { ...ctx, deliverableId: result.deliverableId };
  }

  // Return updated context - frontend will update its store
  return { success: true, mode, context: ctx, payload };
}
```

**Key Difference:**
- **Frontend**: Single context per conversation, stored in Pinia store (reactive, shared across components in same browser session)
- **Backend**: Context comes with each request, passed through call stack (isolated per request, stateless, works across multiple users/browsers/servers)

**Concurrency Guarantees:**
- Request A from User 1 (Browser Tab 1) → Has its own ctx → Never mixes with Request B
- Request B from User 1 (Browser Tab 2) → Has its own ctx → Never mixes with Request A
- Request C from User 2 → Has its own ctx → Never mixes with User 1's requests
- All three can execute simultaneously with zero cross-contamination
- Works across multiple server instances (horizontal scaling) - no shared state needed

**Why This Architecture Works:**

✅ **Request-Scoped Context Pattern** - Well-established pattern (similar to Express `req` object, NestJS request context)
✅ **Stateless Backend** - Perfect for horizontal scaling, load balancing, serverless
✅ **No Race Conditions** - Each request has isolated context, no shared mutable state
✅ **Easy to Reason About** - Context flows with request, easy to trace and debug
✅ **Observability Friendly** - Each request can be traced independently using its context
✅ **Multi-Tenant Safe** - User A's context never accidentally used for User B's request

**Potential Considerations:**

⚠️ **Context Validation** - Must validate context at API boundary (controller level)
⚠️ **Never Null** - Backend should never receive null/undefined context (validate early)
⚠️ **Type Safety** - Use `isExecutionContext()` guard to ensure valid structure
⚠️ **Error Handling** - If context is missing/invalid, fail fast with clear error

**Implementation Recommendation:**

```typescript
// ✅ GOOD: Validate at controller boundary
async executeTask(@Body() body: TaskRequestDto) {
  if (!body.context || !isExecutionContext(body.context)) {
    throw new BadRequestException('Valid ExecutionContext is required');
  }
  // Now we know context is valid - pass it through with confidence
  return await this.gateway.execute(body.context, body);
}

// ❌ BAD: Assuming context exists without validation
async executeTask(@Body() body: TaskRequestDto) {
  // What if body.context is null? What if it's missing fields?
  return await this.gateway.execute(body.context, body); // Dangerous!
}
```

### New File Structure

```
apps/web/src/services/agent2agent/
├── orchestrator/
│   ├── index.ts                    # Main export
│   ├── a2a-orchestrator.ts         # Core orchestrator class
│   ├── request-switch.ts           # Outbound request routing
│   ├── response-switch.ts          # Inbound response handling
│   └── types.ts                    # Orchestrator-specific types
├── api/                            # (existing - keep)
├── utils/
│   ├── builders/                   # (existing - keep)
│   └── handlers/                   # (existing - keep, used by response-switch)
└── actions/                        # (deprecated - migrate to orchestrator)
```

### Core Orchestrator Interface

```typescript
// apps/web/src/services/agent2agent/orchestrator/types.ts

import type { AgentTaskMode } from '@orchestrator-ai/transport-types';

/**
 * All possible triggers that can initiate an A2A call
 */
export type A2ATrigger =
  // Plan triggers
  | 'plan.create'
  | 'plan.read'
  | 'plan.list'
  | 'plan.edit'
  | 'plan.rerun'
  | 'plan.set_current'
  | 'plan.delete_version'
  | 'plan.merge_versions'
  | 'plan.copy_version'
  | 'plan.delete'
  // Build triggers
  | 'build.create'
  | 'build.read'
  | 'build.list'
  | 'build.edit'
  | 'build.rerun'
  | 'build.set_current'
  | 'build.delete_version'
  | 'build.merge_versions'
  | 'build.copy_version'
  | 'build.delete'
  // Converse triggers
  | 'converse.send'
  // HITL triggers
  | 'hitl.approve'
  | 'hitl.reject'
  | 'hitl.regenerate'
  | 'hitl.replace'
  | 'hitl.skip'
  | 'hitl.status'
  | 'hitl.history'
  | 'hitl.pending';

/**
 * Use existing ExecutionContext from transport-types
 *
 * ExecutionContext contains all entity IDs:
 * - orgSlug, userId, agentSlug, agentType
 * - conversationId, taskId, planId, deliverableId
 * - provider, model
 *
 * NIL_UUID Pattern:
 * For optional entities (planId when no plan, deliverableId before creation),
 * use NIL_UUID ('00000000-0000-0000-0000-000000000000') instead of null/undefined.
 * This keeps the interface consistent and avoids null checks.
 *
 * @see apps/transport-types/core/execution-context.ts
 */
import { ExecutionContext, NIL_UUID, isNilUuid } from '@orchestrator-ai/transport-types';

/**
 * Trigger-specific payload data (action-specific fields only)
 *
 * Note: Entity IDs (conversationId, taskId, planId, deliverableId) are in ExecutionContext.
 * Payload only contains action-specific data like versionId, userMessage, feedback, etc.
 */
export interface A2APayload {
  // Version-related (for version operations)
  versionId?: string;

  // Content-related
  userMessage?: string;
  feedback?: string;
  editedContent?: unknown;

  // Rerun-specific LLM override (for regenerating with a different model)
  // Note: This is DIFFERENT from ExecutionContext's provider/model which is the system default
  // This allows one-time override for a specific rerun without changing the system default
  rerunLlmOverride?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };

  // Multi-version operations
  versionIds?: string[];
  mergePrompt?: string;
}

/**
 * Unified result type - what the UI receives
 *
 * Note: All results include the updated ExecutionContext from the response.
 * The ExecutionContext store is automatically updated by handleA2AResponse(),
 * but the result also includes it for convenience.
 */
export type A2AResult =
  | { type: 'plan'; plan: PlanData; version: PlanVersionData; context: ExecutionContext }
  | { type: 'deliverable'; deliverable: DeliverableData; version: DeliverableVersionData; context: ExecutionContext }
  | { type: 'message'; message: string; metadata?: Record<string, unknown>; context: ExecutionContext }
  | { type: 'hitl_waiting'; taskId: string; topic: string; generatedContent: HitlGeneratedContent; context: ExecutionContext }
  | { type: 'success'; message?: string; context: ExecutionContext }
  | { type: 'error'; error: string; code?: number; context?: ExecutionContext };
```

### Request Switch Implementation

```typescript
// apps/web/src/services/agent2agent/orchestrator/request-switch.ts

import type { A2ATrigger, A2APayload } from './types';
import type { StrictA2ARequest } from '@orchestrator-ai/transport-types';
import { buildRequest } from '../utils/builders';
// NOTE: Builders get context from store internally - no import needed here

/**
 * Maps triggers to transport mode × action and builds the request
 *
 * **Key Principle:** Context is NEVER passed between methods.
 * Each builder function gets context from the store internally.
 * This function only maps triggers to the appropriate builder.
 */
export function buildA2ARequest(
  trigger: A2ATrigger,
  payload: A2APayload
): StrictA2ARequest {
  // NOTE: We do NOT get context here - each builder gets it from the store internally

  switch (trigger) {
    // ═══════════════════════════════════════════════════════════
    // PLAN TRIGGERS
    // ═══════════════════════════════════════════════════════════
    case 'plan.create':
      return buildRequest.plan.create({ userMessage: payload.userMessage! });

    case 'plan.read':
      return buildRequest.plan.read({ versionId: payload.versionId });

    case 'plan.list':
      return buildRequest.plan.list();

    case 'plan.edit':
      return buildRequest.plan.edit({ editedContent: payload.editedContent });

    case 'plan.rerun':
      return buildRequest.plan.rerun({
        versionId: payload.versionId!,
        llmOverride: payload.rerunLlmOverride!,
        userMessage: payload.userMessage,
      });

    case 'plan.set_current':
      return buildRequest.plan.setCurrent({ versionId: payload.versionId! });

    case 'plan.delete_version':
      return buildRequest.plan.deleteVersion({ versionId: payload.versionId! });

    case 'plan.merge_versions':
      return buildRequest.plan.mergeVersions({
        versionIds: payload.versionIds!,
        mergePrompt: payload.mergePrompt!,
      });

    case 'plan.copy_version':
      return buildRequest.plan.copyVersion({ versionId: payload.versionId! });

    case 'plan.delete':
      return buildRequest.plan.delete();

    // ═══════════════════════════════════════════════════════════
    // BUILD TRIGGERS
    // ═══════════════════════════════════════════════════════════
    case 'build.create':
      return buildRequest.build.create({ userMessage: payload.userMessage! });

    case 'build.read':
      return buildRequest.build.read({ versionId: payload.versionId });

    case 'build.list':
      return buildRequest.build.list();

    case 'build.edit':
      return buildRequest.build.edit({ editedContent: payload.editedContent });

    case 'build.rerun':
      return buildRequest.build.rerun({
        versionId: payload.versionId!,
        llmOverride: payload.rerunLlmOverride!,
        userMessage: payload.userMessage,
      });

    case 'build.set_current':
      return buildRequest.build.setCurrent({ versionId: payload.versionId! });

    case 'build.delete_version':
      return buildRequest.build.deleteVersion({ versionId: payload.versionId! });

    case 'build.merge_versions':
      return buildRequest.build.mergeVersions({
        versionIds: payload.versionIds!,
        mergePrompt: payload.mergePrompt!,
      });

    case 'build.copy_version':
      return buildRequest.build.copyVersion({ versionId: payload.versionId! });

    case 'build.delete':
      return buildRequest.build.delete();

    // ═══════════════════════════════════════════════════════════
    // CONVERSE TRIGGERS
    // ═══════════════════════════════════════════════════════════
    case 'converse.send':
      return buildRequest.converse.send({ userMessage: payload.userMessage! });

    // ═══════════════════════════════════════════════════════════
    // HITL TRIGGERS
    // ═══════════════════════════════════════════════════════════
    case 'hitl.approve':
      return buildRequest.hitl.resume({ decision: 'approve' });

    case 'hitl.reject':
      return buildRequest.hitl.resume({ decision: 'reject' });

    case 'hitl.regenerate':
      return buildRequest.hitl.resume({
        decision: 'regenerate',
        feedback: payload.feedback!,
      });

    case 'hitl.replace':
      return buildRequest.hitl.resume({
        decision: 'replace',
        content: payload.editedContent as HitlGeneratedContent,
      });

    case 'hitl.skip':
      return buildRequest.hitl.resume({ decision: 'skip' });

    case 'hitl.status':
      return buildRequest.hitl.status();

    case 'hitl.history':
      return buildRequest.hitl.history();

    case 'hitl.pending':
      return buildRequest.hitl.pending({ agentSlug: '_system' });

    default:
      throw new Error(`Unknown trigger: ${trigger}`);
  }
}
```

### Response Switch Implementation

```typescript
// apps/web/src/services/agent2agent/orchestrator/response-switch.ts

import type { A2AResult } from './types';
import type { TaskResponse, HitlDeliverableResponse } from '@orchestrator-ai/transport-types';
import { useExecutionContextStore } from '@/stores/execution-context.store';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { usePlanStore } from '@/stores/planStore';
import { useConversationsStore } from '@/stores/conversationsStore';
import { deliverablesService } from '@/services/deliverablesService';

/**
 * Handles all A2A responses - the response mode determines what we do
 *
 * CRITICAL: The response mode may differ from the request mode!
 * - BUILD request can return HITL response (hitl_waiting)
 * - HITL request can return BUILD response (completed with deliverable)
 *
 * CRITICAL: Updates ExecutionContext store after every response!
 * The backend may have updated the context (added planId/deliverableId),
 * so we must update the store with the returned context.
 * 
 * **Context Handling (Store-First Approach):**
 * - Gets ExecutionContext from store internally (never passed as parameter)
 * - Updates ExecutionContext store with response.context after processing
 * - All store updates happen here - single source of truth for response handling
 */
export async function handleA2AResponse(
  response: TaskResponse
): Promise<A2AResult> {
  // Get context from store (store-first approach)
  const executionContextStore = useExecutionContextStore();
  
  // Update ExecutionContext store with response context (backend may have updated it)
  // This is the ONLY place context changes (besides user changing provider/model)
  if (response.context) {
    executionContextStore.update(response.context);
  }
  
  // Get updated context from store for use in this function
  const ctx = executionContextStore.current;

  // Fail-fast on error responses
  // Note: HITL responses use success=true with status='hitl_waiting', so this is safe
  if (!response.success) {
    throw new Error(response.error?.message || 'Request failed');
  }

  const mode = response.mode;
  const content = response.payload?.content;
  const metadata = response.payload?.metadata;

  switch (mode) {
    // ═══════════════════════════════════════════════════════════
    // PLAN RESPONSES
    // ═══════════════════════════════════════════════════════════
    case 'plan': {
      const planStore = usePlanStore();
      const plan = content?.plan;
      const version = content?.version;

      if (plan) {
        planStore.addPlan(plan);
        planStore.associatePlanWithConversation(plan.id, ctx.conversationId);
      }

      if (version && plan) {
        planStore.addVersion(plan.id, version);
        if (version.isCurrentVersion) {
          planStore.setCurrentVersion(plan.id, version.id);
        }
      }

      return {
        type: 'plan',
        plan,
        version,
        context: response.context, // Include updated context in result
      };
    }

    // ═══════════════════════════════════════════════════════════
    // BUILD RESPONSES
    // ═══════════════════════════════════════════════════════════
    case 'build': {
      const deliverablesStore = useDeliverablesStore();
      const deliverable = content?.deliverable;
      const version = content?.version;

      if (deliverable) {
        deliverablesStore.addDeliverable(deliverable);
        deliverablesStore.associateDeliverableWithConversation(
          deliverable.id,
          ctx.conversationId
        );
      }

      if (version && deliverable) {
        deliverablesStore.addVersion(deliverable.id, version);
        if (version.isCurrentVersion) {
          deliverablesStore.setCurrentVersion(deliverable.id, version.id);
        }
      }

      return {
        type: 'deliverable',
        deliverable,
        version,
        context: response.context, // Include updated context in result
      };
    }

    // ═══════════════════════════════════════════════════════════
    // CONVERSE RESPONSES
    // ═══════════════════════════════════════════════════════════
    case 'converse': {
      const conversationsStore = useConversationsStore();
      const message = content?.message || response.humanResponse?.message;

      if (message) {
        conversationsStore.addMessage(ctx.conversationId, {
          role: 'assistant',
          content: message,
          timestamp: new Date().toISOString(),
          metadata: {
            provider: metadata?.provider,
            model: metadata?.model,
            thinking: response.humanResponse?.thinking,
          },
        });
      }

      return {
        type: 'message',
        message,
        metadata,
        context: response.context, // Include updated context in result
      };
    }

    // ═══════════════════════════════════════════════════════════
    // HITL RESPONSES
    // ═══════════════════════════════════════════════════════════
    case 'hitl': {
      const hitlContent = content as HitlDeliverableResponse;
      const status = hitlContent?.status;

      // HITL still waiting (e.g., after regenerate)
      if (status === 'hitl_waiting' || status === 'regenerating') {
        return {
          type: 'hitl_waiting',
          taskId: hitlContent.taskId,
          topic: hitlContent.topic || '',
          generatedContent: hitlContent.generatedContent,
          context: response.context, // Include updated context in result
        };
      }

      // HITL completed - fetch and return the deliverable
      if (status === 'completed') {
        const deliverablesStore = useDeliverablesStore();
        const deliverableId = hitlContent.deliverableId;

        if (deliverableId) {
          // Fetch the full deliverable data
          const deliverable = await deliverablesService.getDeliverable(deliverableId);

          // Add to store
          deliverablesStore.addDeliverable(deliverable);
          deliverablesStore.associateDeliverableWithConversation(
            deliverable.id,
            ctx.conversationId
          );

          // Add completion message to conversation
          const conversationsStore = useConversationsStore();
          conversationsStore.addMessage(ctx.conversationId, {
            role: 'assistant',
            content: hitlContent.message || 'Content finalized!',
            timestamp: new Date().toISOString(),
            metadata: {
              hitlCompleted: true,
              deliverableId,
            },
          });

          return {
            type: 'deliverable',
            deliverable,
            version: deliverable.currentVersion,
            context: response.context, // Include updated context in result
          };
        }

        return {
          type: 'success',
          message: hitlContent.message,
          context: response.context, // Include updated context in result
        };
      }

      // HITL rejected
      if (status === 'rejected') {
        return {
          type: 'success',
          message: 'Content rejected',
          context: response.context, // Include updated context in result
        };
      }

      // HITL pending list response
      if (content?.items) {
        return {
          type: 'success',
          message: `${content.items.length} pending reviews`,
          context: response.context, // Include updated context in result
        };
      }

      // Default - return whatever we got
      return {
        type: 'success',
        message: hitlContent?.message,
        context: response.context, // Include updated context in result
      };
    }

    // ═══════════════════════════════════════════════════════════
    // UNKNOWN MODE
    // ═══════════════════════════════════════════════════════════
    default:
      console.warn(`Unknown response mode: ${mode}`);
      return {
        type: 'error',
        error: `Unknown response mode: ${mode}`,
      };
  }
}
```

### Main Orchestrator

```typescript
// apps/web/src/services/agent2agent/orchestrator/a2a-orchestrator.ts

import type { A2ATrigger, A2APayload, A2AResult } from './types';
import { buildA2ARequest } from './request-switch';
import { handleA2AResponse } from './response-switch';
import { createAgent2AgentApi } from '../api';
// NOTE: No store import needed here - each function gets context from store internally

/**
 * Unified A2A Orchestrator
 *
 * Single entry point for ALL A2A calls. The transport type determines:
 * 1. How to build the request (request-switch)
 * 2. How to handle the response (response-switch)
 *
 * Uses ExecutionContext - the core context that flows through the entire system.
 *
 * Usage:
 * ```typescript
 * const result = await a2aOrchestrator.execute('hitl.approve', payload);
 *
 * switch (result.type) {
 *   case 'deliverable':
 *     openDeliverablesModal(result.deliverable);
 *     break;
 *   case 'hitl_waiting':
 *     // Stay in modal, show new content
 *     break;
 *   case 'error':
 *     showError(result.error);
 *     break;
 * }
 * ```
 */
class A2AOrchestrator {
  /**
   * Execute an A2A call
   *
   * @param trigger - What action triggered this call
   * @param payload - Trigger-specific payload data (versionId, feedback, etc.)
   * @returns Unified result that UI can switch on
   *
   * **Context Handling (Store-First Approach):**
   * - Context is NEVER passed as parameters between functions
   * - Each function gets context from store internally when it needs it:
   *   - buildA2ARequest() → builders get context from store
   *   - createAgent2AgentApi() → gets agentSlug/orgSlug from store
   *   - handleA2AResponse() → gets/updates context from store
   * - Only the backend can update context (adds planId/deliverableId)
   * - Store is automatically updated with returned context after response
   * - User can change provider/model via executionContextStore.setLLM()
   */
  async execute(
    trigger: A2ATrigger,
    payload: A2APayload = {}
  ): Promise<A2AResult> {
    try {
      // 1. Build the request - gets context from store internally
      const request = buildA2ARequest(trigger, payload);

      // 2. Send to API - gets agentSlug/orgSlug from store internally
      const api = createAgent2AgentApi();
      const response = await api.executeStrictRequest(request);

      // 3. Handle response - gets context from store internally
      // This also updates the ExecutionContext store with the returned context
      return await handleA2AResponse(response);

    } catch (error) {
      console.error(`A2A Orchestrator error for trigger ${trigger}:`, error);
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const a2aOrchestrator = new A2AOrchestrator();
```

## Critical Implementation Details

### ExecutionContext Store Initialization

**When:** The store must be initialized when a conversation is selected/loaded.

**Where:** In conversation selection handlers (e.g., `ConversationTabs.vue`, `ConversationView.vue`, `AgentsPage.vue`).

**How:**
```typescript
// When conversation is selected/loaded
const executionContextStore = useExecutionContextStore();
const rbacStore = useRbacStore();
const userPreferencesStore = useUserPreferencesStore();

// Get conversation data (already loaded)
const conversation = conversationsStore.conversationById(conversationId);
const agent = agentsStore.availableAgents?.find(a => a.name === conversation.agentName);

// Initialize ExecutionContext store
executionContextStore.initialize({
  orgSlug: rbacStore.currentOrganization!,
  userId: rbacStore.user!.id,
  conversationId: conversation.id,
  agentSlug: agent.slug,
  agentType: agent.type,
  provider: userPreferencesStore.preferredProvider || 'Ollama',
  model: userPreferencesStore.preferredModel || 'GPT-OSS:20B',
});

// If conversation already has plan/deliverable, update store after loading
// (This happens when loading existing conversations)
```

**Navigation:** When user switches conversations:
1. Call `executionContextStore.clear()` for old conversation
2. Initialize new context for new conversation
3. If conversation has existing plan/deliverable, fetch and update context

### Error Handling Strategy

**Orchestrator Level:**
- All errors caught in `a2aOrchestrator.execute()` → returns `{ type: 'error', error: string, code?: number }`
- Never throws - always returns error result
- Logs errors for debugging

**Component Level:**
- Components switch on `result.type === 'error'`
- Show user-friendly error messages
- Don't try to recover automatically - let user decide

**Network Errors:**
- Timeout errors → `{ type: 'error', error: 'Request timed out', code: 408 }`
- Network failures → `{ type: 'error', error: 'Network error', code: 0 }`
- API errors → `{ type: 'error', error: response.error.message, code: response.error.code }`

**Validation Errors:**
- Missing context → `{ type: 'error', error: 'ExecutionContext not initialized', code: 400 }`
- Invalid payload → `{ type: 'error', error: 'Invalid payload: ...', code: 400 }`

### SSE/Streaming Integration

**For `build.create` trigger:**
- Add optional `onProgress` callback to `a2aOrchestrator.execute()`
- Set up SSE connection in orchestrator (not in components)
- Stream progress events to callback
- Handle cancellation if user navigates away
- Store updates happen on final response (not during streaming)

**Implementation:**
```typescript
// Future enhancement - not in Phase 1
async execute(
  trigger: A2ATrigger,
  payload: A2APayload = {},
  options?: {
    onProgress?: (progress: TaskProgressEvent) => void;
    signal?: AbortSignal;
  }
): Promise<A2AResult>
```

### Testing Strategy

**Unit Tests:**
- Test `request-switch.ts` - all 25 triggers map correctly
- Test `response-switch.ts` - all response modes handled correctly
- Test `a2a-orchestrator.ts` - error handling, store updates

**Integration Tests:**
- Test full flow: trigger → request → API → response → store update
- Test HITL flows: BUILD → HITL → BUILD
- Test context updates: planId/deliverableId added correctly

**E2E Tests:**
- Test user creates plan → store has planId
- Test user creates deliverable → store has deliverableId
- Test HITL approve → modal closes, deliverable shown
- Test HITL regenerate → modal stays open, content updates

### Migration Validation Checklist

**After each phase:**
- [ ] All old code paths deleted (grep for deprecated methods)
- [ ] All new code paths working (test all triggers)
- [ ] No console errors in browser
- [ ] Store updates correctly after responses
- [ ] Error handling works (test with invalid inputs)
- [ ] TypeScript compiles without errors
- [ ] No references to deleted files (grep for imports)

### Backend Context Validation Rules

**At Controller Boundary:**
```typescript
// Validate ExecutionContext structure
if (!request.context || !isExecutionContext(request.context)) {
  throw new BadRequestException('Valid ExecutionContext is required');
}

// Validate required fields are not NIL_UUID (where applicable)
if (!request.context.orgSlug || !request.context.userId || !request.context.conversationId) {
  throw new BadRequestException('ExecutionContext missing required fields');
}

// Validate user matches authenticated user
if (request.context.userId !== currentUser.id) {
  throw new ForbiddenException('ExecutionContext userId does not match authenticated user');
}
```

### Type Definitions Required

**New types to create:**
- `A2ATrigger` - union of all 25 trigger strings
- `A2APayload` - action-specific payload data
- `A2AResult` - union of all result types (plan, deliverable, message, hitl_waiting, success, error)

**Types to update:**
- Builder signatures to accept `ExecutionContext` as first parameter
- `TaskResponse` to guarantee `context` field is always present

## Migration Plan

### Migration Philosophy: Complete Removal, No Fallbacks

**This is a v2 cleanup effort. We are NOT keeping old code "just in case."**

- ✅ **DO**: Remove old code immediately after migration
- ✅ **DO**: Delete deprecated services, actions, and utilities
- ✅ **DO**: Update all call sites in a single commit per phase
- ❌ **DON'T**: Keep old code with deprecation warnings
- ❌ **DON'T**: Maintain parallel code paths
- ❌ **DON'T**: Add fallback logic to old implementations

**Rationale:** Keeping old code creates technical debt, confusion about which path to use, and makes the codebase harder to maintain. Complete removal forces us to ensure the new implementation is correct and complete.

### Phase 1: Add Orchestrator (Non-Breaking)

**PRD Sections:** [New File Structure](#new-file-structure), [Core Orchestrator Interface](#core-orchestrator-interface), [ExecutionContext Initialization Lifecycle](#executioncontext-initialization-lifecycle)

1. Create new `orchestrator/` directory with all files
2. **Update all builders to get context from store internally (store-first approach):**
   - Change `buildRequest.plan.create(metadata, ...)` → `buildRequest.plan.create(payload)` (gets ctx from store)
   - Change `buildRequest.build.create(metadata, ...)` → `buildRequest.build.create(payload)` (gets ctx from store)
   - Change `buildRequest.converse.send(metadata, ...)` → `buildRequest.converse.send(payload)` (gets ctx from store)
   - Change `buildRequest.hitl.resume(metadata, ...)` → `buildRequest.hitl.resume(payload)` (gets ctx from store)
   - Each builder calls `useExecutionContextStore().current` internally to get context
   - **Context is NEVER passed as a parameter between frontend methods**
3. Add HITL builders to existing builders (currently missing)
4. Export orchestrator from `agent2agent/index.ts`
5. **Keep existing code working temporarily** (only for this phase)

### Phase 2: Migrate HITL First

**PRD Sections:** [HITL Triggers](#hitl-triggers) (in Request Switch), [HITL Responses](#hitl-responses) (in Response Switch), [Component Usage Example](#component-usage-example)

1. Update `HitlReviewModal.vue` to use orchestrator instead of hitlService
2. Update `ConversationView.vue` to use orchestrator for HITL decisions
3. Remove `handleHitlDecision` from ConversationView - it becomes automatic
4. Test HITL approve/reject/regenerate/replace flows thoroughly
5. **DELETE `hitlService.ts` completely** - no deprecation, just remove it
6. **DELETE any HITL-related code in `tasksService.ts`** if present

### Phase 3: Migrate Build Actions

**PRD Sections:** [Build Triggers](#build-triggers) (in Request Switch), [Build Responses](#build-responses) (in Response Switch), [SSE Progress Updates](#3-sse-progress-updates), [Appendix C: Build Actions](#all-25-supported-combinations)

1. Update `createDeliverable` to use orchestrator
2. Update `rerunDeliverable` to use orchestrator
3. Update all version operations (set_current, delete_version, merge, copy)
4. Remove inline HITL detection (handled by response-switch)
5. **DELETE `build.actions.ts` completely**
6. **DELETE build-related methods from `tasksService.ts`**

### Phase 3.5: SSE ExecutionContext Migration

**PRD Sections:** [SSE Progress Updates](#3-sse-progress-updates)

**Breaking Change:** SSE types now require full `ExecutionContext` capsule instead of individual fields.

**Backend Updates Required:**

1. Update all SSE event emitters to include full `ExecutionContext`:
   ```typescript
   // OLD (individual fields)
   emit({
     organizationSlug: 'acme',
     agentSlug: 'writer',
     conversationId: '...',
     // ...
   });

   // NEW (full capsule)
   emit({
     context: executionContext,  // Full ExecutionContext
     userMessage: request.userMessage,
     streamId: '...',
     mode: 'build',
     timestamp: new Date().toISOString(),
   });
   ```

2. Files to update (search for SSE event emission):
   - `apps/api/src/agent2agent/services/` - any file emitting SSE events
   - `apps/api/src/streaming/` - SSE service/gateway if exists
   - Any runner that emits progress events

3. **Frontend Updates:**
   - Update SSE event handlers to read `event.data.context.taskId` instead of `event.data.taskId`
   - Update SSE store to use full context

4. **Verification:**
   - Test build.create with streaming enabled
   - Verify progress events show in UI
   - Verify observability can correlate SSE events with tasks/plans/deliverables

### Phase 4: Migrate Plan Actions

**PRD Sections:** [Plan Triggers](#plan-triggers) (in Request Switch), [Plan Responses](#plan-responses) (in Response Switch), [Appendix C: Plan Actions](#all-25-supported-combinations)

1. Update `createPlan` to use orchestrator
2. Update `rerunPlan` to use orchestrator
3. Update all version operations
4. **DELETE `plan.actions.ts` completely**
5. **DELETE plan-related methods from `tasksService.ts`**

### Phase 5: Migrate Converse

**PRD Sections:** [Converse Triggers](#converse-triggers) (in Request Switch), [Converse Responses](#converse-responses) (in Response Switch)

1. Update `sendMessage` to use orchestrator
2. Simplify message handling
3. **DELETE `converse.actions.ts` completely**
4. **DELETE converse-related methods from `tasksService.ts`**

### Phase 6: Final Cleanup

**PRD Sections:** [Appendix A: Old Code Removal Checklist](#4-old-code-removal-checklist), [Appendix E: Backend ActionExecutionContext Migration](#appendix-e-backend-actionexecutioncontext-migration)

1. **DELETE `tasksService.createAgentTask()` method** (entire method, not just deprecate)
2. **DELETE `agentExecutionService.ts` file completely** (legacy fallback)
3. **DELETE `buildExecutionContext` utility** if it exists (replaced by ExecutionContext store)
4. Remove any remaining references to old action files
5. Update all imports across the codebase
6. **Backend: Complete `ActionExecutionContext` removal** (see Appendix E)
   - DELETE `ActionExecutionContext` interface completely
   - DELETE `buildPlanActionContext()` function
   - Verify zero references: `grep -r "ActionExecutionContext" apps/api`
7. Run full test suite to ensure nothing broke
8. Document the new pattern in code comments and README

## Component Usage Example

```vue
<!-- After migration: HitlReviewModal.vue -->
<script setup lang="ts">
import { a2aOrchestrator } from '@/services/agent2agent/orchestrator';

async function handleApprove() {
  isSubmitting.value = true;

  // Orchestrator gets context from store automatically
  const result = await a2aOrchestrator.execute('hitl.approve', {});

  isSubmitting.value = false;

  // The transport type determines the result
  switch (result.type) {
    case 'deliverable':
      // HITL completed - close modal, deliverable already in store
      emit('completed', result.deliverable);
      break;
    case 'hitl_waiting':
      // Regenerate case - stay open, update content
      generatedContent.value = result.generatedContent;
      break;
    case 'error':
      error.value = result.error;
      break;
  }
}
</script>
```

## Success Criteria

1. **Single entry point** - All A2A calls go through `a2aOrchestrator.execute()`
2. **Transport-driven** - Request switch and response switch use transport types exclusively
3. **Automatic store updates** - Response handler updates correct store based on mode
4. **No inline handling** - Components don't parse responses, they switch on result.type
5. **HITL works correctly** - Approve shows deliverable, regenerate stays in modal
6. **All 29 triggers work** - Every frontend trigger maps to correct backend handler (see Appendix C)
7. **Complete migration** - All old code removed, no fallbacks or deprecated code paths remain

## Appendix A: Current Frontend Outliers

### 1. ApprovalsService
- Different endpoint: `/approvals/{id}/continue`
- Decision: Keep separate OR integrate as `approval.continue` trigger
- Recommendation: Keep separate for now, different workflow
- **Note:** This is NOT part of the A2A orchestrator migration - it's a separate system

### 2. AgentExecutionService
- Legacy fallback
- **Decision: DELETE completely in Phase 6**
- No current usage identified
- **No fallback logic** - if it's not being used, remove it entirely

### 3. SSE Progress Updates
- `createDeliverable` sets up SSE for progress
- Decision: Keep SSE setup in orchestrator for build.create trigger
- Add optional `onProgress` callback to execute()
- **Migration:** Move SSE setup into orchestrator, remove from old action files

**SSE Context Alignment (Phase 3 Recommended):**

The current `AgentStreamContext` in `sse-events.types.ts` has similar but different fields than `ExecutionContext`:

| AgentStreamContext | ExecutionContext | Action |
|-------------------|------------------|--------|
| `organizationSlug` | `orgSlug` | Rename to match |
| `agentSlug` | `agentSlug` | ✓ Same |
| `conversationId` | `conversationId` | ✓ Same |
| `mode` | (in request) | ✓ Keep |
| `streamId` | (SSE-specific) | ✓ Keep |
| (missing) | `userId` | Add |
| (missing) | `taskId` | Add |
| (missing) | `planId` | Add |
| (missing) | `deliverableId` | Add |

**Decision:** `AgentStreamContext` includes full `ExecutionContext` capsule - context travels whole, never cherry-picked:

```typescript
// ✅ IMPLEMENTED: Full capsule
export interface AgentStreamContext {
  context: ExecutionContext;  // Full execution context (REQUIRED - never partial)
  streamId: string;           // SSE-specific
  mode: string;               // Agent task mode
  timestamp: string;          // ISO timestamp
}

// ❌ REJECTED: No partial context
// We do NOT use Pick<> or cherry-pick fields
```

This ensures SSE events can be correlated with tasks, plans, and deliverables for observability. The capsule pattern is consistent across all transport types.

### 4. Old Code Removal Checklist

**Files to DELETE completely (no deprecation):**

**Frontend:**
- ✅ `apps/web/src/services/hitlService.ts`
- ✅ `apps/web/src/services/agent2agent/actions/build.actions.ts`
- ✅ `apps/web/src/services/agent2agent/actions/plan.actions.ts`
- ✅ `apps/web/src/services/agent2agent/actions/converse.actions.ts`
- ✅ `apps/web/src/services/agentExecutionService.ts`
- ✅ `apps/web/src/utils/executionContext.ts` (if replaced by ExecutionContext store)

**Backend:**
- ✅ `ActionExecutionContext` interface from `apps/api/src/agent2agent/common/interfaces/action-handler.interface.ts`
- ✅ `buildPlanActionContext()` function from `apps/api/src/agent2agent/services/base-agent-runner/plan.handlers.ts`
- ✅ Any type aliases or re-exports of `ActionExecutionContext`

**Methods to DELETE from existing files:**
- ✅ `tasksService.createAgentTask()` - entire method
- ✅ Any HITL-related methods in `tasksService.ts`
- ✅ Any build/plan/converse methods in `tasksService.ts` that are replaced by orchestrator

**Import cleanup:**
- ✅ Remove all imports of deleted files
- ✅ Update all call sites to use orchestrator
- ✅ Remove unused type definitions from deleted files
- ✅ **Backend:** Remove all imports of `ActionExecutionContext`, replace with `ExecutionContext` from transport-types
- ✅ **Verification:** Run `grep -r "ActionExecutionContext" apps/api` - should return zero results

---

## Appendix B: Backend Routing Architecture

The backend already has a well-structured routing architecture that matches the transport types:

### Backend Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Controller: executeTask()                                       │
│ ├─ Detect JSON-RPC vs REST                                     │
│ ├─ Normalize to TaskRequestDto (guarantee mode is set)         │
│ ├─ Detect HITL methods (mode=HITL or method starts 'hitl.')   │
│ └─ Create task (or reuse for HITL)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Execution Gateway: execute()                                    │
│ ├─ Get agent record + build runtime definition                 │
│ ├─ Check mode is supported (canConverse/canPlan/canBuild)      │
│ └─ Delegate to Mode Router                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Mode Router: execute()                                          │
│ └─ Get runner by agentType → runner.execute()                 │
│    (Runner handles all modes including HITL)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Runner: execute() - MAIN MODE SWITCH                           │
│ switch (mode) {                                                 │
│   case CONVERSE: → handleConverse()                            │
│   case PLAN:     → handlePlan() with ACTION SWITCH (10 actions)│
│   case BUILD:    → handleBuild() with ACTION SWITCH (10 actions)│
│   case HITL:     → handleHitl() with METHOD SWITCH (4 methods) │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Switch Statements

**Level 1: Mode Switch (base-agent-runner.service.ts:117)**
```typescript
switch (mode) {
  case AgentTaskMode.CONVERSE: return await this.handleConverse(...);
  case AgentTaskMode.PLAN:     return await this.handlePlan(...);
  case AgentTaskMode.BUILD:    return await this.handleBuild(...);
  case AgentTaskMode.HITL:     return await this.handleHitl(...);
}
```

**Level 2a: PLAN Action Switch (base-agent-runner.service.ts:205)**
```typescript
switch (action) {
  case 'create':         return await this.handlePlanCreate(...);
  case 'read':           return await this.handlePlanRead(...);
  case 'list':           return await this.handlePlanList(...);
  case 'edit':           return await this.handlePlanEdit(...);
  case 'rerun':          return await this.handlePlanRerun(...);
  case 'set_current':    return await this.handlePlanSetCurrent(...);
  case 'delete_version': return await this.handlePlanDeleteVersion(...);
  case 'merge_versions': return await this.handlePlanMergeVersions(...);
  case 'copy_version':   return await this.handlePlanCopyVersion(...);
  case 'delete':         return await this.handlePlanDelete(...);
}
```

**Level 2b: BUILD Action Switch (base-agent-runner.service.ts:327)**
```typescript
switch (action) {
  case 'create':         return await this.executeBuild(...);
  case 'read':           return await this.handleBuildRead(...);
  case 'list':           return await this.handleBuildList(...);
  case 'edit':           return await this.handleBuildEdit(...);
  case 'rerun':          return await this.handleBuildRerun(...);
  case 'set_current':    return await this.handleBuildSetCurrent(...);
  case 'delete_version': return await this.handleBuildDeleteVersion(...);
  case 'merge_versions': return await this.handleBuildMergeVersions(...);
  case 'copy_version':   return await this.handleBuildCopyVersion(...);
  case 'delete':         return await this.handleBuildDelete(...);
}
```

**Level 2c: HITL Method Switch (api-agent-runner.service.ts:159)**
```typescript
switch (hitlMethod) {
  case 'hitl.resume':  return this.handleHitlResumeMethod(...);
  case 'hitl.status':  return this.executeHitlStatus(...);
  case 'hitl.history': return this.executeHitlHistory(...);
  case 'hitl.pending': return this.handleHitlPending(...);
}
```

### Backend Response Building

All responses use `TaskResponseDto` factory methods:

```typescript
// Success responses
TaskResponseDto.success(mode, { content, metadata })

// Failure responses
TaskResponseDto.failure(mode, reason)

// HITL-specific responses
TaskResponseDto.hitlWaiting(payload, metadata)   // Paused for review
TaskResponseDto.hitlCompleted(payload, metadata) // Approved
TaskResponseDto.hitlRejected(payload, metadata)  // Rejected
TaskResponseDto.hitlStatus(payload, metadata)    // Status query result
```

### Backend Gaps Identified

1. **Missing base handleHitl()** - Not implemented in base runner (throws error if called)
2. **No action validation** - Invalid actions may fall through to defaults
3. **Inconsistent HITL response types** - History uses generic success() instead of standardized format
4. **Missing capability matrix** - No explicit definition of which runners support which modes/actions

### Backend Recommendations (Fail-Fast, No Fallbacks)

**Critical Principle: Throw errors immediately - no silent fallbacks or defaults.**

1. **Add action validation enum** - Validate against allowed values, throw `BadRequestException` on invalid action
2. **Implement base handleHitl()** - Throw `NotImplementedException` if runner doesn't support HITL (no fallback)
3. **Standardize HITL responses** - All HITL responses use `hitlStatus()` factory method for consistency
4. **Define per-runner capability matrix** - Each runner class declares its supported modes/actions as static properties

**Capability Matrix Storage Recommendation:**

Each runner class should define its capability matrix as static properties in code:

```typescript
// Example: api-agent-runner.service.ts
export class ApiAgentRunner extends BaseAgentRunner {
  // Runner-level capabilities: What this runner implementation CAN do
  // This is the FULL set of possibilities - all agents using this runner
  // can potentially use any of these, but individual agents may only use a subset
  static readonly SUPPORTED_MODES = ['converse', 'plan', 'build', 'hitl'] as const;
  static readonly SUPPORTED_PLAN_ACTIONS = ['create', 'read', 'list', 'edit', 'rerun', 'set_current', 'delete_version', 'merge_versions', 'copy_version', 'delete'] as const;
  static readonly SUPPORTED_BUILD_ACTIONS = ['create', 'read', 'list', 'edit', 'rerun', 'set_current', 'delete_version', 'merge_versions', 'copy_version', 'delete'] as const;
  static readonly SUPPORTED_HITL_METHODS = ['hitl.resume', 'hitl.status', 'hitl.history', 'hitl.pending'] as const;

  // Runtime validation method
  validateModeAndAction(mode: string, action?: string, method?: string, agentConfig?: AgentConfig): void {
    // First check: Can the runner handle this?
    if (!ApiAgentRunner.SUPPORTED_MODES.includes(mode as any)) {
      throw new BadRequestException(`Mode '${mode}' not supported by ApiAgentRunner`);
    }
    
    // Second check: Does this specific agent have this enabled?
    // (Agent config comes from database - agent.metadata.supported_modes, etc.)
    if (agentConfig && !agentConfig.supportedModes.includes(mode)) {
      throw new BadRequestException(`Agent '${agentConfig.slug}' does not have mode '${mode}' enabled`);
    }
    
    // ... validate action/method based on mode
  }
}
```

**Example: Two agents using the same runner, different capabilities:**

```typescript
// Agent 1: Marketing Blog Writer (uses ApiAgentRunner)
// Database record:
{
  slug: 'marketing-blog-writer',
  agent_type: 'api',
  capabilities: ['content_generation', 'seo', 'blog_posts'],  // Agent-level
  metadata: {
    supported_modes: ['converse', 'build', 'hitl'],  // Agent has HITL enabled
    // ... other config
  }
}

// Agent 2: Simple API Caller (uses ApiAgentRunner)
// Database record:
{
  slug: 'simple-api-caller',
  agent_type: 'api',
  capabilities: ['api_integration', 'data_fetching'],  // Agent-level
  metadata: {
    supported_modes: ['converse', 'build'],  // Agent does NOT have HITL enabled
    // ... other config
  }
}
```

**Validation Flow:**
1. **Runner check**: "Can ApiAgentRunner handle HITL?" → ✅ Yes (runner supports it)
2. **Agent check**: 
   - Marketing Blog Writer → ✅ Yes (agent has `hitl` in `supported_modes`)
   - Simple API Caller → ❌ No (agent doesn't have `hitl` in `supported_modes`) → Throw error

**Key Point:**
- **Runner capabilities** = What's POSSIBLE (full set of what the runner can do)
- **Agent capabilities** = What's ENABLED (subset that this specific agent uses)
- Both must pass validation, or throw error immediately

**Two Types of Capabilities:**

1. **Agent-Level Capabilities** (Database-Stored, Agent-Specific):
   - Stored in `agents.capabilities` JSONB field in database
   - Come from agent definition (agent.json/yaml) - each agent has different values
   - Exposed via `.well-known/agent.json` endpoint via `AgentCardBuilderService.deriveCapabilities()`
   - Describe what the agent can do (e.g., `["can_generate", "blog_posts", "seo_optimization"]`)
   - Agent-specific configuration that comes from the agent definition itself
   - Example: Marketing agent might have `["content_generation", "seo", "social_media"]`
   - Example: Metrics agent might have `["analytics", "reporting", "data_visualization"]`

2. **Runner-Level Capabilities** (Code-Stored, Implementation-Specific):
   - Stored as static properties in runner class code
   - Define what the runner implementation can actually handle
   - Same for all agents using that runner type
   - Example: All API agents use `ApiAgentRunner` which supports `['converse', 'plan', 'build', 'hitl']`

**Why This Separation:**
- **Agent capabilities** = What the agent is configured to do (from agent definition, stored in DB)
- **Runner capabilities** = What the runner implementation can execute (from code, implementation detail)
- Agent capabilities are agent-specific and come from the agent definition
- Runner capabilities are runner-type-specific and come from the implementation

**Validation Flow:**
1. **Agent capabilities from database** → Validated when agent is loaded/imported (must match agent definition)
2. **Agent's `supported_modes` from database** → Checked at gateway level (can this agent handle this mode?)
3. **Runner's capability matrix from code** → Checked at runner level (can this runner implementation handle this mode/action?)
4. All must pass, or throw error immediately

**Critical: Agent Capabilities Must Match Agent Definition**
- When importing/creating an agent from agent.json/yaml, capabilities must be properly stored in database
- The `.well-known/agent.json` endpoint reads from `agent.capabilities` field
- If capabilities are missing or incorrect in database, the endpoint will expose incorrect information
- Migration must ensure agent capabilities from agent definitions are properly persisted to database

---

## Appendix C: Complete Mode × Action Matrix

### All 25 Supported Combinations

| Mode | Action/Method | Frontend Trigger | Backend Handler | Response Type |
|------|---------------|------------------|-----------------|---------------|
| **CONVERSE** | (implicit) | converse.send | handleConverse | ConverseResponseContent |
| **PLAN** | create | plan.create | handlePlanCreate | PlanCreateResponseContent |
| **PLAN** | read | plan.read | handlePlanRead | PlanReadResponseContent |
| **PLAN** | list | plan.list | handlePlanList | PlanListResponseContent |
| **PLAN** | edit | plan.edit | handlePlanEdit | (version update) |
| **PLAN** | rerun | plan.rerun | handlePlanRerun | PlanRerunResponseContent |
| **PLAN** | set_current | plan.set_current | handlePlanSetCurrent | success |
| **PLAN** | delete_version | plan.delete_version | handlePlanDeleteVersion | success |
| **PLAN** | merge_versions | plan.merge_versions | handlePlanMergeVersions | PlanMergeResponseContent |
| **PLAN** | copy_version | plan.copy_version | handlePlanCopyVersion | PlanCopyResponseContent |
| **PLAN** | delete | plan.delete | handlePlanDelete | success |
| **BUILD** | create | build.create | executeBuild | BuildCreateResponseContent |
| **BUILD** | read | build.read | handleBuildRead | BuildReadResponseContent |
| **BUILD** | list | build.list | handleBuildList | BuildListResponseContent |
| **BUILD** | edit | build.edit | handleBuildEdit | (version update) |
| **BUILD** | rerun | build.rerun | handleBuildRerun | BuildRerunResponseContent |
| **BUILD** | set_current | build.set_current | handleBuildSetCurrent | success |
| **BUILD** | delete_version | build.delete_version | handleBuildDeleteVersion | success |
| **BUILD** | merge_versions | build.merge_versions | handleBuildMergeVersions | BuildMergeResponseContent |
| **BUILD** | copy_version | build.copy_version | handleBuildCopyVersion | BuildCopyResponseContent |
| **BUILD** | delete | build.delete | handleBuildDelete | success |
| **HITL** | hitl.resume | hitl.approve/reject/etc | handleHitlResumeMethod | HitlDeliverableResponse |
| **HITL** | hitl.status | hitl.status | executeHitlStatus | HitlStatusResponse |
| **HITL** | hitl.history | hitl.history | executeHitlHistory | HitlHistoryResponse |
| **HITL** | hitl.pending | hitl.pending | handleHitlPending | HitlPendingListResponse |

### Runner Capability Matrix

| Agent Type | CONVERSE | PLAN | BUILD | HITL |
|------------|----------|------|-------|------|
| context | ✓ | ✓ | ✓ | ✗ |
| api | ✓ | ✓ | ✓ | ✓ |
| external | ✓ | ✓ | ✓ | ✗ |
| rag-runner | ✓ | ✗ | ✗ | ✗ |
| orchestrator | ✓ | ✓ | ✓ | ✗ |

---

## Appendix D: Symmetry Between Frontend and Backend

### The Goal: Mirror Architecture

Both frontend and backend should have identical switch structures:

**Frontend (Request Orchestrator)**
```typescript
switch (trigger) {
  case 'plan.create':    → buildRequest(PLAN, 'create', ...)
  case 'plan.read':      → buildRequest(PLAN, 'read', ...)
  case 'build.create':   → buildRequest(BUILD, 'create', ...)
  case 'hitl.approve':   → buildRequest(HITL, 'resume', { decision: 'approve' })
  // ... all 25 combinations
}
```

**Backend (Mode Router + Runner)**
```typescript
switch (mode) {
  case PLAN:  → switch (action) { case 'create': ... case 'read': ... }
  case BUILD: → switch (action) { case 'create': ... case 'read': ... }
  case HITL:  → switch (method) { case 'resume': ... case 'status': ... }
  // ... all 25 combinations
}
```

**Frontend (Response Orchestrator)**
```typescript
switch (response.mode) {
  case 'plan':     → updatePlanStore(response.payload)
  case 'build':    → updateDeliverablesStore(response.payload)
  case 'converse': → updateConversationsStore(response.payload)
  case 'hitl':     → checkStatus → either updateStore or showModal
}
```

**Backend (Response Builder)**
```typescript
// Already uses TaskResponseDto factories:
TaskResponseDto.success(mode, payload)
TaskResponseDto.hitlWaiting(payload)
TaskResponseDto.hitlCompleted(payload)
// Response mode determines frontend handling
```

### Key Insight

The transport type flows through the entire system:
1. **Frontend trigger** → determines request mode + action
2. **Backend routing** → uses mode + action to select handler
3. **Backend response** → includes mode in response
4. **Frontend handling** → uses response mode to update correct store

The response mode may DIFFER from request mode (BUILD → HITL for paused workflows), and both sides must handle this correctly.

---

## Appendix E: Backend ActionExecutionContext Migration

### Problem: Duplicate Context Types

The backend currently has **two different context types**:

1. **`ExecutionContext`** (from `@orchestrator-ai/transport-types`) - The full context that flows through the A2A system
2. **`ActionExecutionContext`** (internal to api) - A slimmed-down context used by domain services

This causes problems:
- **Observability gaps**: Missing `orgSlug` causes separate swim lanes in traces
- **Inconsistent entity tracking**: `planId` not passed through the stack
- **Duplicate context creation**: Context rebuilt at multiple layers, losing information

### Solution: Use ExecutionContext Everywhere (Complete Removal)

**Migration Philosophy:** Complete removal of `ActionExecutionContext` - no fallbacks, no gradual migration, no backward compatibility.

Replace all `ActionExecutionContext` usage with `ExecutionContext` from transport-types. This ensures:
- Full context flows through the entire call stack
- Observability has consistent tracking IDs
- No information loss between layers
- **Single source of truth** - only one context type in the entire system

### Files Requiring Migration

#### 1. Interface Definition (DELETE COMPLETELY)
**File:** `apps/api/src/agent2agent/common/interfaces/action-handler.interface.ts`
- **Line 11:** `export interface ActionExecutionContext extends JsonObject { ... }` - **DELETE this entire interface**
- **Line 52:** `context: ActionExecutionContext` in `IActionHandler` interface - **CHANGE to `ExecutionContext`**
- **Action:** 
  1. Import `ExecutionContext` from `@orchestrator-ai/transport-types`
  2. Replace all `ActionExecutionContext` references with `ExecutionContext`
  3. **DELETE the `ActionExecutionContext` interface definition completely**
- **Note:** `IActionHandler.executeAction()` signature must change to use `ExecutionContext`
- **Verification:** After migration, `grep -r "ActionExecutionContext"` should return zero results

#### 2. Plans Service (12 occurrences)
**File:** `apps/api/src/agent2agent/plans/services/plans.service.ts`
- **Line 15:** Import statement
- **Line 60:** `executeAction()` method signature
- **Line 191:** `createOrRefine()` parameter
- **Line 247:** `getCurrentPlan()` parameter
- **Line 278:** `getVersionHistory()` parameter
- **Line 304:** `saveManualEdit()` parameter
- **Line 374:** `rerunWithDifferentLLM()` parameter
- **Line 400:** `setCurrentVersion()` parameter
- **Line 418:** `deleteVersion()` parameter
- **Line 460:** `mergeVersions()` parameter
- **Line 507:** `copyVersion()` parameter
- **Line 540:** `deletePlan()` parameter
- **Action:** Change all to use `ExecutionContext`, access fields via new names (e.g., `ctx.orgSlug` instead of missing field)

#### 3. Deliverables Service (12 occurrences)
**File:** `apps/api/src/agent2agent/deliverables/deliverables.service.ts`
- **Line 28:** Import statement
- **Line 125:** `executeAction()` method signature
- **Line 272:** Private method parameter
- **Line 364:** `getCurrentDeliverable()` parameter
- **Line 400:** `getVersionHistory()` parameter
- **Line 430:** Private method parameter
- **Line 488:** Private method parameter
- **Line 514:** Private method parameter
- **Line 535:** Private method parameter
- **Line 573:** Private method parameter
- **Line 617:** Private method parameter
- **Line 647:** `deleteDeliverable()` parameter
- **Action:** Same as plans service

#### 4. Plan Handlers (DELETE Function)
**File:** `apps/api/src/agent2agent/services/base-agent-runner/plan.handlers.ts`
- **Line 39:** Import statement - **CHANGE to import `ExecutionContext` from transport-types**
- **Line 1055:** `buildPlanActionContext()` function - **DELETE this entire function**
- **Action:** 
  1. **DELETE `buildPlanActionContext()` completely** - it rebuilds context and loses fields
  2. Pass the incoming `ExecutionContext` directly through to services
  3. No context rebuilding - use the capsule as-is
- **Critical:** This function is the source of context loss - removing it fixes observability gaps

#### 5. Context Agent Runner Service (3 occurrences)
**File:** `apps/api/src/agent2agent/services/context-agent-runner.service.ts`
- **Line 24:** Import statement
- **Line 163:** Context creation `const executionContext: ActionExecutionContext = { ... }`
- **Line 487:** Method parameter
- **Action:** Pass through the `ExecutionContext` that was created at the controller level instead of rebuilding it

### Migration Strategy

#### Phase 1: Update Interface
1. Change `IActionHandler.executeAction()` to accept `ExecutionContext`
2. **DO NOT add re-export for backward compatibility** - we're doing complete migration
3. Update all implementations immediately (no gradual migration)

#### Phase 2: Update Plan Stack
1. Update `plan.handlers.ts` `buildPlanActionContext()` to use incoming `ExecutionContext`
2. Update `PlansService` to use `ExecutionContext`
3. Pass `ExecutionContext` from runner through to service

#### Phase 3: Update Deliverables Stack
1. Update `DeliverablesService` to use `ExecutionContext`
2. Pass `ExecutionContext` from runner through to service

#### Phase 4: Update Context Agent Runner
1. Stop rebuilding context at line 163
2. Use the `ExecutionContext` passed from controller/gateway

#### Phase 5: Complete Removal (No Fallbacks)
1. **DELETE `ActionExecutionContext` interface definition** from `action-handler.interface.ts`
2. **DELETE any type aliases or re-exports** of `ActionExecutionContext`
3. **DELETE `buildPlanActionContext()` function** - it rebuilds context and loses fields
4. Update all imports to use `ExecutionContext` from transport-types only
5. Run full test suite to ensure no references remain
6. **Verify:** `grep -r "ActionExecutionContext" apps/api` should return zero results

### Field Mapping

| ActionExecutionContext | ExecutionContext | Notes |
|------------------------|------------------|-------|
| `conversationId` | `conversationId` | Same |
| `userId` | `userId` | Same |
| `agentSlug` | `agentSlug` | Same |
| `taskId` | `taskId` | Same |
| `metadata` | (removed) | Move to request payload |
| (missing) | `orgSlug` | **Critical for observability** |
| (missing) | `planId` | Use NIL_UUID when no plan |
| (missing) | `deliverableId` | Use NIL_UUID when no deliverable |
| (missing) | `agentType` | For runner selection |
| (missing) | `provider` | For LLM calls |
| (missing) | `model` | For LLM calls |

### Why This Matters for Observability

Currently, when a plan action is executed:
1. Controller creates `ExecutionContext` with full fields
2. Gateway passes it to runner
3. Runner calls `buildPlanActionContext()` which creates NEW `ActionExecutionContext`
4. This NEW context is missing `orgSlug`, `planId`, etc.
5. Observability sees different context → creates separate swim lane

After migration:
1. Controller creates `ExecutionContext` with full fields
2. Same context flows through gateway → runner → service
3. All operations have same context → single swim lane in observability

---

## Appendix F: LangGraph ExecutionContext Pattern

### Overview

The LangGraph application (`apps/langgraph/`) follows the **exact same ExecutionContext pattern** as the Orchestrator API. Both are NestJS applications that:

1. **Receive immutable ExecutionContext** - It's fully formed when received, never constructed internally
2. **Pass it through unchanged** - Controller → Service → Graph nodes → Shared services
3. **Use shared services for complexity** - Graphs stay simple, services handle HTTP/observability

### Architecture: Identical Pattern Across Apps

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR API (NestJS)                                │
│                                                                                  │
│  Request → Controller → Gateway → Runner → Services (Plans, Deliverables, LLM)  │
│              ↓                              ↓                                    │
│       ExecutionContext              Pass through unchanged                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          LANGGRAPH APP (NestJS)                                  │
│                                                                                  │
│  Request → Controller → Service → Graph Nodes → Shared Services (LLM, Observ.)  │
│              ↓                       ↓                                           │
│       ExecutionContext         state.executionContext                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Principle: Simplify Graphs, Centralize Complexity

**Rule:** Keep LangGraph graphs simple. All HTTP calls, observability, and complex operations should go through application-level services.

```typescript
// ✅ GOOD: Graph node uses shared service
async function generateBlogPostNode(state: ExtendedPostWriterState) {
  const ctx = state.executionContext;

  // Complexity is in ObservabilityService, not in the graph
  await observability.emitProgress(ctx, ctx.taskId, 'Generating blog post', {
    step: 'generate_blog_post',
    progress: 20,
  });

  // LLM calls through shared service
  const result = await llmService.callLLM({
    context: ctx,
    userMessage: 'Write a blog post about...',
  });

  return { blogPost: result.text };
}

// ❌ BAD: Graph node making direct HTTP calls
async function generateBlogPostNode(state: ExtendedPostWriterState) {
  // Don't do HTTP directly in graph nodes!
  await fetch('http://localhost:6100/webhooks/status', {
    method: 'POST',
    body: JSON.stringify({ ... })
  });
}
```

### Transport Type as Source of Truth

**Critical:** Both apps use `ExecutionContext` from `@orchestrator-ai/transport-types` - NOT separate DTOs.

```typescript
// apps/transport-types/core/execution-context.ts
export interface ExecutionContext {
  orgSlug: string;
  userId: string;
  conversationId: string;
  taskId: string;
  planId: string;
  deliverableId: string;
  agentSlug: string;
  agentType: string;
  provider: string;
  model: string;
}

// Type guard for runtime validation
export function isExecutionContext(obj: unknown): obj is ExecutionContext { ... }
```

Both the Orchestrator API and LangGraph app:
1. Import `ExecutionContext` from transport-types
2. Use `isExecutionContext()` for validation
3. Pass the context through unchanged

The NestJS DTOs are just validation wrappers - they contain `context: ExecutionContext` using the transport type directly.

### LangGraph ExecutionContext Flow

#### 1. Request Uses Transport Type

```typescript
// LangGraph receives ExecutionContext from transport-types
// The DTO is just validation boilerplate - ExecutionContext IS the transport type
import { ExecutionContext, isExecutionContext } from '@orchestrator-ai/transport-types';

// Request shape (the context field IS ExecutionContext from transport-types)
interface LangGraphRequest {
  context: ExecutionContext;  // Transport type - not a DTO
  userMessage: string;
}
```

#### 2. Controller → Service

```typescript
// apps/langgraph/src/agents/data-analyst/data-analyst.controller.ts
@Post('analyze')
async analyze(@Body() request: { context: ExecutionContext; userMessage: string }) {
  // Validate using transport-types type guard
  if (!isExecutionContext(request.context)) {
    throw new BadRequestException('Invalid ExecutionContext');
  }
  // Context is validated and complete - just pass it through
  return this.dataAnalystService.analyze(request);
}

// apps/langgraph/src/agents/data-analyst/data-analyst.service.ts
async analyze(request: { context: ExecutionContext; userMessage: string }) {
  const context = request.context;  // Extract - don't construct

  // Pass to graph as initial state
  const initialState: Partial<DataAnalystState> = {
    executionContext: context,  // Unchanged
    userMessage: request.userMessage,
    status: 'started',
  };

  // taskId becomes LangGraph thread_id
  const config = { configurable: { thread_id: context.taskId } };

  return await this.graph.invoke(initialState, config);
}
```

#### 3. Graph State

```typescript
// apps/langgraph/src/hitl/hitl-base.state.ts
export const HitlBaseStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  // ExecutionContext flows through entire workflow - never modified
  executionContext: Annotation<ExecutionContext>({
    reducer: (_, next) => next,  // Simple replacement
    default: () => ({ /* placeholder - MUST be set on invoke */ }),
  }),

  // HITL state...
});
```

#### 4. Graph Nodes Use Services

```typescript
// Graph node - kept simple
async function initializeNode(state: ExtendedPostWriterState) {
  const ctx = state.executionContext;

  // All observability through shared service
  await observability.emitStarted(ctx, ctx.taskId, 'Starting workflow');

  return { status: 'processing' };
}
```

### Shared Services Pattern

#### ObservabilityService

```typescript
// apps/langgraph/src/services/observability.service.ts
@Injectable()
export class ObservabilityService {
  async emitProgress(
    context: ExecutionContext,  // Takes full context
    threadId: string,
    message: string,
    options?: { step?: string; progress?: number }
  ): Promise<void> {
    // Service handles all HTTP complexity
    await this.httpService.post(url, {
      context,  // Pass through unchanged
      taskId: context.taskId,
      status: 'langgraph.processing',
      // ...
    });
  }
}
```

#### LLMHttpClientService

```typescript
// apps/langgraph/src/services/llm-http-client.service.ts
@Injectable()
export class LLMHttpClientService {
  async callLLM(request: {
    context: ExecutionContext;  // Full context
    userMessage: string;
  }): Promise<LLMCallResponse> {
    return this.httpService.post(url, {
      context: request.context,  // Pass through
      options: {
        provider: request.context.provider,
        model: request.context.model,
      },
    });
  }
}
```

### Thread ID Consistency

**Critical:** `context.taskId` is used as the LangGraph `thread_id`:

```typescript
// Service sets up graph invocation
const config = {
  configurable: {
    thread_id: context.taskId,  // taskId IS the thread_id
  },
};
const result = await this.graph.invoke(initialState, config);

// Resume uses same taskId
async resume(taskId: string, decision: HitlResponse) {
  const config = { configurable: { thread_id: taskId } };
  return await this.graph.invoke(new Command({ resume: decision }), config);
}
```

### What the Graph DOESN'T Do

Graphs should NOT:
- ❌ Construct ExecutionContext (receive it complete)
- ❌ Make direct HTTP calls (use services)
- ❌ Access databases directly (API Runner handles persistence)
- ❌ Track versions (API DeliverablesService handles versioning)
- ❌ Handle observability HTTP (use ObservabilityService)

Graphs SHOULD:
- ✅ Read `state.executionContext` when needed
- ✅ Call shared services for side effects
- ✅ Return state updates
- ✅ Use `interrupt()` for HITL pauses

### Summary: Same Pattern, Both Apps

| Aspect | Orchestrator API | LangGraph App |
|--------|------------------|---------------|
| Framework | NestJS | NestJS |
| **Context Type** | `ExecutionContext` from transport-types | `ExecutionContext` from transport-types |
| **Validation** | `isExecutionContext()` type guard | `isExecutionContext()` type guard |
| Context Source | Request body | Request body |
| Context Flow | Controller → Gateway → Runner → Services | Controller → Service → Graph → Services |
| Context Mutation | Never (backend only adds planId/deliverableId) | Never |
| Observability | StreamingService | ObservabilityService |
| LLM Calls | LLM service | LLMHttpClientService |
| Thread ID | taskId | taskId (as thread_id) |

**Key Principle:** Both apps use the **transport type** (`ExecutionContext` from `@orchestrator-ai/transport-types`) directly. No separate DTOs for context - the transport type IS the contract.

**ExecutionContext is an immutable capsule that flows through the entire system unchanged.**
