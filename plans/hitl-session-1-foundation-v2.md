# HITL Refactoring Session 1: Foundation (v2 - Deliverable-Centric)

## Goal
Update transport types and LangGraph base state for deliverable-based HITL. Use `taskId` consistently throughout.

## Prerequisites
- Supabase running locally
- LangGraph service running
- API service running

---

## Overview

This session establishes:
1. Updated HITL transport types (use `taskId`, reference deliverables)
2. Simplified HitlBaseStateAnnotation (use `taskId`, no version tracking)
3. Verify frontend already uses existing deliverablesService

**Key Principles**:
- Use existing `DeliverablesService` and `DeliverableVersionsService` - no new version tracking
- Use `taskId` consistently (LangGraph uses it as `thread_id` internally)
- No separate HITL controller - use existing A2A endpoint
- No new database tables - LangGraph checkpointer stores HITL state

---

## Task 1: HITL Transport Types Updates

### 1.1 Update HITL Types to Use taskId and Reference Deliverables

**File**: `apps/transport-types/modes/hitl.types.ts`

Update existing types and add new ones:

```typescript
// Update existing types to use taskId instead of threadId

/**
 * HITL Response with Deliverable (returned by API to frontend)
 */
export interface HitlDeliverableResponse {
  /** Task ID for resuming (used as LangGraph thread_id) */
  taskId: string;
  /** Current HITL status */
  status: HitlStatus;
  /** Deliverable ID */
  deliverableId: string;
  /** Current version number */
  currentVersionNumber: number;
  /** Message for the user */
  message: string;
  /** Topic/subject */
  topic?: string;
  /** Agent that generated this */
  agentSlug?: string;
  /** Node that triggered HITL (for serialized HITL) */
  nodeName?: string;
}

/**
 * HITL Resume Request (from frontend to API via A2A endpoint)
 */
export interface HitlResumeRequest {
  /** Task ID to resume */
  taskId: string;
  /** User's decision */
  decision: HitlDecision;
  /** Feedback for regeneration (required if decision is 'regenerate') */
  feedback?: string;
  /** Replacement content (required if decision is 'replace') */
  content?: HitlGeneratedContent;
}

/**
 * HITL Status Response
 */
export interface HitlStatusResponse {
  /** Task ID */
  taskId: string;
  /** Current status */
  status: HitlStatus;
  /** Whether HITL is pending review */
  hitlPending: boolean;
  /** Deliverable ID (if exists) */
  deliverableId?: string;
  /** Current version number */
  currentVersionNumber?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * HITL History Response (uses deliverable versions)
 */
export interface HitlHistoryResponse {
  /** Task ID */
  taskId: string;
  /** Deliverable ID */
  deliverableId: string;
  /** Total version count */
  versionCount: number;
  /** Current version number */
  currentVersionNumber: number;
}
```

### 1.2 Update Existing HITL Payload Types

Update `HitlResumePayload` to use `taskId`:

```typescript
export interface HitlResumePayload {
  action: 'resume';
  taskId: string;  // Changed from threadId
  decision: HitlDecision;
  editedContent?: Partial<HitlGeneratedContent>;
  feedback?: string;
}

export interface HitlStatusPayload {
  action: 'status';
  taskId: string;  // Changed from threadId
}

export interface HitlHistoryPayload {
  action: 'history';
  taskId: string;  // Changed from threadId
}
```

### 1.3 Export New Types

**File**: `apps/transport-types/index.ts`

Add to HITL Mode exports:
```typescript
// HITL Mode
export type {
  // ... existing exports ...
  // New deliverable-based types
  HitlDeliverableResponse,
  HitlResumeRequest,
  HitlStatusResponse,
  HitlHistoryResponse,
} from './modes/hitl.types';
```

---

## Task 2: Simplified HitlBaseStateAnnotation

### 2.1 Create Base State (taskId, No Version Tracking)

**File**: `apps/langgraph/src/hitl/hitl-base.state.ts`

```typescript
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { HitlDecision, HitlStatus } from '@orchestrator-ai/transport-types';

/**
 * Base state annotation for all HITL-capable workflows.
 * Individual agents extend this with their domain-specific fields.
 *
 * KEY DESIGN DECISIONS:
 * 1. Uses `taskId` consistently (passed to LangGraph as thread_id config)
 * 2. NO version tracking in state - API Runner handles via DeliverablesService
 * 3. NO direct DB access from LangGraph - framework-agnostic
 * 4. HITL state (pending, decision, feedback) stored here for checkpointer
 */
export const HitlBaseStateAnnotation = Annotation.Root({
  // Include message history from LangGraph
  ...MessagesAnnotation.spec,

  // === Task Identification ===
  // taskId is THE identifier - passed to LangGraph as thread_id config
  taskId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  conversationId: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  organizationSlug: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // === LLM Configuration ===
  provider: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'ollama',
  }),
  model: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'llama3.2:1b',
  }),

  // === HITL State ===
  // These are stored in LangGraph checkpointer - no separate table needed
  hitlDecision: Annotation<HitlDecision | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlFeedback: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlPending: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  // Track which node triggered HITL (for serialized HITL)
  hitlNodeName: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // === Workflow Status ===
  status: Annotation<HitlStatus>({
    reducer: (_, next) => next,
    default: () => 'started',
  }),
  error: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  startedAt: Annotation<number>({
    reducer: (_, next) => next,
    default: () => Date.now(),
  }),
  completedAt: Annotation<number | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

export type HitlBaseState = typeof HitlBaseStateAnnotation.State;

/**
 * Helper to check if state extends HitlBaseState
 */
export function isHitlState(state: unknown): state is HitlBaseState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'taskId' in state &&
    'hitlDecision' in state &&
    'hitlPending' in state
  );
}
```

### 2.2 Create Index Export

**File**: `apps/langgraph/src/hitl/index.ts`

```typescript
export * from './hitl-base.state';
```

---

## Task 3: Verify Frontend Uses Existing Deliverables Infrastructure

### 3.1 Check hitlService.ts

The frontend `hitlService.ts` already:
- Uses the A2A endpoint correctly (`/agent-to-agent/:org/:agent/tasks`)
- Sends JSON-RPC methods (`hitl.resume`, `hitl.status`, `hitl.history`)
- Has `taskId` in some places (may need to update `threadId` → `taskId`)

**Changes needed in `apps/web/src/services/hitlService.ts`:**
- Replace `threadId` with `taskId` in method parameters
- Ensure payload uses `taskId`

### 3.2 Check deliverablesService.ts

Already has all needed methods:
- `getVersionHistory(deliverableId)` ✓
- `getVersion(versionId)` ✓
- `setCurrentVersion(versionId)` ✓
- `createVersion()` ✓
- `enhanceVersion()` ✓

**No changes needed** - just use these from HitlApprovalModal

### 3.3 Check deliverablesStore.ts

Already has all needed methods:
- `getDeliverableVersionsSync()` ✓
- `getCurrentVersion()` ✓
- `setCurrentVersion()` ✓
- `addVersion()` ✓

**No changes needed** - just use these from components

---

## Task 4: Update Frontend hitlService to Use taskId

### 4.1 Update hitlService.ts

**File**: `apps/web/src/services/hitlService.ts`

Replace `threadId` with `taskId` throughout:

```typescript
// In resume method signature
async resume(
  agentSlug: string,
  taskId: string,  // Changed from threadId
  conversationId: string,
  request: HitlResumeRequest,
  originalTaskId?: string
): Promise<HitlResumeResponse> {
  // ...
  const payload: HitlResumePayload = {
    action: 'resume',
    taskId,  // Changed from threadId
    decision: request.decision,
    // ...
  };
  // ...
}

// In getStatus method
async getStatus(
  agentSlug: string,
  taskId: string,  // Changed from threadId
  conversationId: string
): Promise<HitlStatusResponse> {
  // ...
  const payload: HitlStatusPayload = {
    action: 'status',
    taskId,  // Changed from threadId
  };
  // ...
}

// In getHistory method
async getHistory(
  agentSlug: string,
  taskId: string,  // Changed from threadId
  conversationId: string
): Promise<HitlHistoryResponse> {
  // ...
  const payload: HitlHistoryPayload = {
    action: 'history',
    taskId,  // Changed from threadId
  };
  // ...
}

// Helper methods
async approve(agentSlug: string, taskId: string, ...): Promise<HitlResumeResponse> {
  return this.resume(agentSlug, taskId, ...);
}

async submitEdits(agentSlug: string, taskId: string, ...): Promise<HitlResumeResponse> {
  return this.resume(agentSlug, taskId, ...);
}

async reject(agentSlug: string, taskId: string, ...): Promise<HitlResumeResponse> {
  return this.resume(agentSlug, taskId, ...);
}
```

---

## Success Criteria

1. [ ] HITL transport types updated to use `taskId`
2. [ ] HitlBaseStateAnnotation created with `taskId` (no `threadId`)
3. [ ] Frontend hitlService.ts updated to use `taskId`
4. [ ] Verified deliverablesService has all needed methods
5. [ ] Verified deliverablesStore has all needed methods
6. [ ] All tests pass: `npm run test`
7. [ ] Build passes: `npm run build`

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `apps/langgraph/src/hitl/hitl-base.state.ts` | Simplified base state with taskId |
| `apps/langgraph/src/hitl/index.ts` | Barrel export |

### Modified Files
| File | Changes |
|------|---------|
| `apps/transport-types/modes/hitl.types.ts` | Use `taskId`, add deliverable response types |
| `apps/transport-types/index.ts` | Export new types |
| `apps/web/src/services/hitlService.ts` | Replace `threadId` with `taskId` |

### Files NOT Created (Removed from Original Plan)
| File | Reason |
|------|--------|
| ~~`hitl.controller.ts`~~ | Use existing A2A endpoint |
| ~~`hitl.service.ts`~~ | Logic goes in API Runner (Session 2) |
| ~~`hitl.module.ts`~~ | No separate module needed |
| ~~`hitl_thread_states` migration~~ | Use LangGraph checkpointer |

---

## Next Session
Session 2 will add HITL method handling to the mode router and API Runner.
