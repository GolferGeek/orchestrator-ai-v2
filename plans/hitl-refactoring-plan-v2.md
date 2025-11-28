# HITL Refactoring Plan v2: Deliverable-Centric Architecture

## Executive Summary

Refactor HITL (Human-in-the-Loop) to create a canonical, repeatable pattern for all workflow engines (LangGraph, N8N, CrewAI):

1. **Deliverables ARE the versions**: No separate version tracking - use existing `deliverables` + `deliverable_versions` tables
2. **API Runner owns all HITL logic**: Creates deliverables, handles decisions, resumes workflows
3. **Workflow engines are dumb**: They just generate content and report it - API Runner does the rest
4. **Framework-agnostic**: Same API endpoints work for LangGraph, N8N, or any future workflow engine
5. **Use existing A2A protocol**: No separate HITL controller - HITL methods handled via A2A endpoint
6. **Use `taskId` consistently**: No threadId/taskId confusion - `taskId` everywhere (LangGraph uses it as thread_id internally)
7. **Modal-based UI**: Single conversation pane + modals for HITL review and deliverable viewing
8. **HITL Pending on Task**: `hitl_pending` lives on the task table (future-proof for multiple tasks per conversation)
9. **Deliverable visibility**: Deliverables with pending HITL show as "Review Needed", not "Ready"

---

## Database Design: Task-Level HITL Pending

### Why Task-Level (Not Conversation-Level)

**Current assumption** (will change):
```
conversation (1) ──→ (1) task ──→ (1) deliverable
```

**Future reality** (we're ready for it):
```
conversation (1) ──→ (N) tasks ──→ (N) deliverables
```

By putting `hitl_pending` on the **task** table:
- Each task knows if it's waiting for review
- Each task already knows its agent
- Each task links to its deliverable
- When we support multiple tasks per conversation, it just works

### The Data Model

```
Task
├── id (taskId)
├── conversation_id
├── agent_id / agent_slug  ← Already has this
├── hitl_pending (boolean) ← ADD THIS
├── hitl_pending_since     ← ADD THIS
└── status

Deliverable
├── id
├── conversation_id
├── task_id               ← ADD THIS (links to creating task)
└── versions[]            ← Latest version = the one to review
```

### Deliverable Visibility Rules

| Task State | Deliverable State | What User Sees |
|------------|-------------------|----------------|
| `hitl_pending = true` | Has versions | **HitlPendingCard** (review needed) |
| `hitl_pending = false` | Has versions | **DeliverableCard** (ready) |
| Task in progress | No deliverable yet | Nothing |

**Key insight**: A deliverable with pending HITL should NOT appear as "ready" - it shows as "needs review".

### Database Migration

```sql
-- Add HITL pending tracking to tasks (NOT conversations)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS hitl_pending BOOLEAN DEFAULT false;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS hitl_pending_since TIMESTAMP WITH TIME ZONE;

-- Link deliverables to their creating task
ALTER TABLE deliverables
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id);

-- Index for efficient pending query
CREATE INDEX IF NOT EXISTS idx_tasks_hitl_pending
ON tasks (hitl_pending, hitl_pending_since DESC)
WHERE hitl_pending = true;

-- Comments for documentation
COMMENT ON COLUMN tasks.hitl_pending IS 'True when task is waiting for HITL review';
COMMENT ON COLUMN tasks.hitl_pending_since IS 'When HITL became pending (for ordering sidebar)';
COMMENT ON COLUMN deliverables.task_id IS 'Task that created this deliverable';
```

### Query for Pending HITL Reviews

```sql
-- All pending HITL reviews for user (for sidebar)
SELECT
  t.id as task_id,
  t.agent_slug,
  t.hitl_pending_since,
  c.id as conversation_id,
  c.title as conversation_title,
  d.id as deliverable_id,
  d.title as deliverable_title,
  (
    SELECT dv.version_number
    FROM deliverable_versions dv
    WHERE dv.deliverable_id = d.id
    ORDER BY dv.version_number DESC
    LIMIT 1
  ) as current_version_number
FROM tasks t
JOIN conversations c ON c.id = t.conversation_id
LEFT JOIN deliverables d ON d.task_id = t.id
WHERE c.user_id = :userId
  AND t.hitl_pending = true
ORDER BY t.hitl_pending_since DESC;
```

### Query for Ready Deliverables (Excludes Pending HITL)

```sql
-- Deliverables ready for viewing (HITL complete or no HITL)
SELECT d.*
FROM deliverables d
JOIN tasks t ON t.id = d.task_id
WHERE d.conversation_id = :conversationId
  AND (t.hitl_pending = false OR t.hitl_pending IS NULL);
```

---

## Frontend Architecture: Single Pane + Modals

### The Problem with Two-Pane Layout
- Complex synchronized state between panes
- Poor mobile experience
- Context switching between panes
- Duplicate UI (HITL modal + right pane showing same content)

### The Solution: Modal-Based Architecture

**Single conversation pane** + **Two modal types**:

| Modal | Trigger | Purpose |
|-------|---------|---------|
| **HITL Review Modal** | Auto-opens when workflow hits interrupt | Review, approve, regenerate, replace |
| **Deliverables Modal** | Auto-opens on completion, or click card in conversation | View history, switch versions, export, edit |

### Auto-Open Behavior

| Event | Action |
|-------|--------|
| Workflow returns with `hitlPending: true` | Auto-open HITL Review Modal |
| Workflow completes with deliverable | Auto-open Deliverables Modal |
| User clicks HITL card in conversation | Open HITL Review Modal |
| User clicks Deliverable card in conversation | Open Deliverables Modal |
| User clicks item in HITL Pending List (sidebar) | Load conversation + open HITL Review Modal |

### Cards Persist in Conversation History

Two card types that persist in chat history:

1. **HitlPendingCard**: Shows when task is waiting for review
2. **DeliverableCard**: Shows after task completes (replaces HITL card)

### HITL Pending List (Sidebar)

Users can have multiple tasks with pending HITL reviews:

```
┌─────────────────────────────────────────────────────────────────┐
│  SIDEBAR                                                        │
├─────────────────────────────────────────────────────────────────┤
│  HITL Reviews Pending (3)                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Blog Post: AI in Healthcare                                │ │
│  │ extended-post-writer - 2 hours ago                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Marketing Copy: Q4 Campaign                                │ │
│  │ marketing-writer - 5 hours ago                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Technical Docs: API Reference                              │ │
│  │ docs-writer - 1 day ago                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Conversations                                                  │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

Clicking an item in the list loads that conversation AND opens the HITL Review Modal.

---

## The Complete User Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              APP LAYOUT                                  │
├──────────────────────┬──────────────────────────────────────────────────┤
│                      │                                                   │
│  SIDEBAR             │              MAIN PANE (Single)                   │
│                      │                                                   │
│  ┌────────────────┐  │  ┌─────────────────────────────────────────────┐ │
│  │ HITL (3)       │  │  │                CONVERSATION                 │ │
│  │ ┌────────────┐ │  │  │                                             │ │
│  │ │ Blog Post  │←───────── Click loads convo + opens HITL modal     │ │
│  │ └────────────┘ │  │  │                                             │ │
│  │ ┌────────────┐ │  │  │  User: Write a blog post...                │ │
│  │ │ Marketing  │ │  │  │                                             │ │
│  │ └────────────┘ │  │  │  Agent: Creating your content...           │ │
│  │ ┌────────────┐ │  │  │                                             │ │
│  │ │ Tech Docs  │ │  │  │  ┌─────────────────────────────────────┐   │ │
│  │ └────────────┘ │  │  │  │ HITL REVIEW NEEDED                 │   │ │
│  └────────────────┘  │  │  │ "AI in Healthcare" - v1             │   │ │
│                      │  │  │ [Click to Review] ← Opens modal     │   │ │
│  ───────────────────  │  │  └─────────────────────────────────────┘   │ │
│                      │  │                                             │ │
│  Conversations       │  │  ... after approval ...                     │ │
│  ┌────────────────┐  │  │                                             │ │
│  │ AI Healthcare  │  │  │  ┌─────────────────────────────────────┐   │ │
│  │ Marketing Q4   │  │  │  │ DELIVERABLE READY                  │   │ │
│  │ Tech Docs      │  │  │  │ "AI in Healthcare" - v2 (Final)    │   │ │
│  └────────────────┘  │  │  │ [View Deliverable] ← Opens modal   │   │ │
│                      │  │  └─────────────────────────────────────┘   │ │
│                      │  │                                             │ │
│                      │  └─────────────────────────────────────────────┘ │
└──────────────────────┴──────────────────────────────────────────────────┘
```

---

## Shared Component Architecture

```
src/components/
├── shared/
│   ├── ContentViewer.vue         # Markdown preview with tabs (blog, SEO, social)
│   ├── ContentEditor.vue         # Editable content areas
│   ├── VersionSelector.vue       # Version history list
│   ├── VersionBadge.vue          # "v2 - AI Enhanced" badge
│   └── FeedbackInput.vue         # Textarea for regeneration feedback
│
├── hitl/
│   ├── HitlReviewModal.vue       # HITL review modal (uses shared components)
│   ├── HitlActionButtons.vue     # Approve/Regenerate/Replace/Reject
│   ├── HitlPendingCard.vue       # Card in conversation history
│   └── HitlPendingList.vue       # Sidebar list of pending reviews
│
├── deliverables/
│   ├── DeliverablesModal.vue     # Deliverables modal (uses shared components)
│   ├── DeliverableActionButtons.vue  # Export/Edit/Rerun
│   └── DeliverableCard.vue       # Card in conversation history
│
└── conversation/
    └── MessageBubble.vue         # Renders cards based on message type
```

### Component Reuse

| Shared Component | Used In HITL Modal | Used In Deliverables Modal |
|------------------|-------------------|---------------------------|
| ContentViewer | Yes | Yes |
| ContentEditor | Yes | Yes |
| VersionSelector | Yes | Yes |
| VersionBadge | Yes | Yes |
| FeedbackInput | Yes (for regenerate) | No |

### Different Actions Per Modal

**HITL Modal actions** (workflow blocking):
- Approve → resumes workflow
- Regenerate → resumes with feedback
- Replace → resumes with user content
- Reject → restarts generation

**Deliverables Modal actions** (async):
- Switch version → updates current version
- Edit → creates new manual version
- Export → download as MD/PDF
- Rerun with AI → triggers new AI enhancement
- Close → just closes

---

## Key Architecture Change from v1

### v1 (Rejected)
```
workflow_content_versions (new table)
    ↓
WorkflowVersionsService (new service)
    ↓
WorkflowVersionsHydratorService (in LangGraph, accesses DB directly)
    ↓
LangGraph manages versions in state
```

### v2 (This Plan)
```
deliverables + deliverable_versions (existing tables)
    ↓
DeliverablesService + DeliverableVersionsService (existing services)
    ↓
API Runner creates/updates deliverables
    ↓
LangGraph just returns content - no DB access
    ↓
Task.hitl_pending controls visibility
```

---

## The Backend Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HITL FLOW (Deliverable-Centric)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User sends message to API                                                │
│     └─→ API Runner receives request                                          │
│     └─→ API Runner creates/gets Task record                                  │
│     └─→ API Runner calls LangGraph workflow                                  │
│                                                                              │
│  2. LangGraph generates content internally                                   │
│     └─→ LangGraph hits interrupt() / HITL pause                              │
│     └─→ LangGraph returns HITL response to API Runner                        │
│         { __interrupt__: [...], values: {blogPost, seo, etc} }               │
│                                                                              │
│  3. API Runner receives HITL response                                        │
│     └─→ API Runner detects __interrupt__ in response                         │
│     └─→ API Runner creates Deliverable + Version 1 (AI_RESPONSE)             │
│     └─→ API Runner sets task.hitl_pending = true                             │
│     └─→ API Runner returns to Frontend:                                      │
│         { status: 'hitl_waiting', deliverableId, taskId, content, ... }      │
│                                                                              │
│  4. Frontend receives response                                               │
│     └─→ Auto-opens HITL Review Modal                                         │
│     └─→ Adds HitlPendingCard to conversation history                         │
│     └─→ Updates HITL Pending List in sidebar                                 │
│                                                                              │
│  5. User makes decision via HITL Modal                                       │
│     └─→ Frontend calls A2A endpoint: {method: 'hitl.resume', ...}            │
│     ├─→ APPROVE: Resume LangGraph (no new version)                           │
│     ├─→ REGENERATE: Resume with feedback → creates AI_ENHANCEMENT version   │
│     ├─→ REPLACE: Creates MANUAL_EDIT version → resumes with user content     │
│     └─→ REJECT: Restarts generation → creates new AI_RESPONSE version       │
│                                                                              │
│  6. Workflow completes                                                       │
│     └─→ LangGraph returns final response (no __interrupt__)                  │
│     └─→ API Runner sets task.hitl_pending = false                            │
│     └─→ API Runner returns completion response                               │
│     └─→ Frontend auto-opens Deliverables Modal                               │
│     └─→ Frontend replaces HitlPendingCard with DeliverableCard               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Types

| Decision | Description | AI Involved? | Creates Version? | DeliverableVersionCreationType |
|----------|-------------|--------------|------------------|-------------------------------|
| **APPROVE** | Accept current content, continue | No | No | - |
| **REJECT** | Discard, regenerate from scratch | Yes | Yes | `AI_RESPONSE` |
| **REGENERATE** | AI creates new version with feedback | Yes | Yes | `AI_ENHANCEMENT` |
| **REPLACE** | User's exact content becomes version | No | Yes | `MANUAL_EDIT` |
| **SKIP** | Auto-approve this review point | No | No | - |

---

## Two-Switch Architecture

### Switch 1: Incoming Request Method
```typescript
switch (request.method) {
  case 'tasks/send':           // Normal BUILD/CONVERSE request
  case 'hitl.resume':          // User made a decision
  case 'hitl.status':          // Query workflow status
  case 'hitl.history':         // Query version history (via deliverable versions)
  case 'hitl.pending':         // Query all pending HITL for user (for sidebar)
}
```

### Switch 2: Response from LangGraph
```typescript
if (response.__interrupt__) {
  // LangGraph called interrupt() - create deliverable version, return HITL response
  await this.setTaskHitlPending(taskId, true);
  const deliverable = await this.createOrUpdateDeliverable(response, taskId);
  return buildHitlPendingResponse(response, deliverable);
} else {
  // Normal completion - return BUILD response with deliverable
  await this.setTaskHitlPending(taskId, false);
  return buildBuildResponse(response, deliverable);
}
```

---

## LangGraph Response Structure

When LangGraph calls `interrupt()`, it returns:

```typescript
interface LangGraphInterruptResponse {
  // Present when interrupt() was called
  __interrupt__: Array<{
    value: {
      reason: string;           // 'human_review'
      nodeName: string;         // Node that called interrupt
      content: HitlGeneratedContent;
      message: string;          // User-facing message
      topic?: string;
    };
    resumable: boolean;         // Always true for HITL
    ns: string[];               // Namespace
  }>;

  // Current state values
  values: {
    taskId: string;
    blogPost: string;
    seoDescription: string;
    socialPosts: string[];
    // ... other state fields
  };
}
```

**Detection logic**:
```typescript
private isHitlResponse(response: unknown): response is LangGraphInterruptResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    '__interrupt__' in response &&
    Array.isArray((response as any).__interrupt__) &&
    (response as any).__interrupt__.length > 0
  );
}
```

---

## Why Deliverables Instead of workflow_content_versions

| Aspect | workflow_content_versions (v1) | Deliverables (v2) |
|--------|-------------------------------|-------------------|
| **Tables** | New table needed | Existing tables |
| **Services** | New service needed | Existing services |
| **Framework Support** | LangGraph only (direct DB) | Any framework (via API) |
| **Frontend Integration** | New UI needed | Existing deliverable UI |
| **Version History** | New feature | Already built |
| **Audit Trail** | New feature | Already built |
| **User Editing** | Would need to build | Already built |
| **Rerun with LLM** | Would need to build | Already built |
| **Merge Versions** | Would need to build | Already built |

---

## Existing Infrastructure We'll Use

### DeliverableVersionCreationType (Already Exists)
```typescript
enum DeliverableVersionCreationType {
  AI_RESPONSE = 'ai_response',       // Initial AI generation
  MANUAL_EDIT = 'manual_edit',       // User replacement
  AI_ENHANCEMENT = 'ai_enhancement', // Regeneration with feedback
  USER_REQUEST = 'user_request',     // User-initiated
  CONVERSATION_TASK = 'conversation_task',
  CONVERSATION_MERGE = 'conversation_merge',
  LLM_RERUN = 'llm_rerun',
}
```

### DeliverablesService Methods (Already Exists)
- `create()` - Create deliverable with initial version
- `createOrEnhance()` - Create or add version to existing
- `findByConversationId()` - Get deliverable for conversation
- `findByTaskId()` - Get deliverable for task (ADD THIS)
- `findOne()` - Get deliverable with current version

### DeliverableVersionsService Methods (Already Exists)
- `createVersion()` - Add new version (auto-increments, sets current)
- `getVersionHistory()` - All versions for deliverable
- `getCurrentVersion()` - Current version
- `setCurrentVersion()` - Promote older version
- `enhanceVersion()` - AI enhancement (regeneration)

---

## What We Need to Add

### 1. Database Migration
- Add `hitl_pending` and `hitl_pending_since` to **tasks** table
- Add `task_id` to **deliverables** table (link deliverable to creating task)
- Index for efficient pending query

### 2. API Runner HITL Method Handling (via existing A2A endpoint)
Handle these methods in the mode router / API runner:
```typescript
switch (request.method) {
  case 'tasks/send':      // Normal BUILD/CONVERSE (existing)
  case 'hitl.resume':     // Resume with decision → calls LangGraph
  case 'hitl.status':     // Get status → reads task.hitl_pending
  case 'hitl.history':    // Get versions → reads deliverable versions
  case 'hitl.pending':    // Get all pending HITL for user → query tasks
}
```
**No separate HITL controller needed** - use existing A2A endpoint.

### 3. API Runner HITL Logic
- Detect HITL response from LangGraph (`__interrupt__` in response)
- Create deliverable on first HITL response (with `task_id`)
- Create versions on regeneration/replacement
- Resume LangGraph with decision
- Update `task.hitl_pending` flag (not conversation)
- Use `taskId` consistently (passed to LangGraph as thread_id)

### 4. HITL Transport Types Updates
- Keep `HitlDecision`, `HitlStatus`, etc.
- Update payload types to reference deliverables
- Use `taskId` instead of `threadId` in all types
- Add `HitlPendingItem` type for sidebar list

### 5. LangGraph Base State (Simplified)
- Use `taskId` (not threadId) in state
- HITL state fields (decision, feedback, pending)
- NO version tracking in state (API Runner handles it)
- NO direct DB access

### 6. Frontend Components (Modal-Based)
- Shared components for content viewing/editing
- HITL Review Modal with version history
- Deliverables Modal with version history
- HitlPendingCard for conversation history
- DeliverableCard for conversation history
- HitlPendingList for sidebar

### 7. TasksService Updates
- Add `setHitlPending(taskId, pending)` method
- Add `findPendingHitl(userId)` method

### 8. DeliverablesService Updates
- Add `findByTaskId(taskId)` method
- Update `create()` to accept `taskId`

---

## Session Breakdown

### Session 1: Foundation
1. Create database migration for `hitl_pending` on tasks + `task_id` on deliverables
2. Update HITL transport types (use `taskId`, reference deliverables, add `HitlPendingItem`)
3. Create simplified HitlBaseStateAnnotation (use `taskId`, no versions)
4. Define shared component interfaces
5. Update frontend hitlService.ts to use A2A JSON-RPC methods consistently

### Session 2: API Runner Integration
1. Add HITL method routing in mode router (`hitl.resume`, `hitl.status`, `hitl.history`, `hitl.pending`)
2. Implement HITL detection in API Runner (`__interrupt__` response)
3. Implement deliverable creation on first HITL response (with `task_id`)
4. Implement `task.hitl_pending` flag updates
5. Implement resume handlers for each decision type
6. Wire up to LangGraph service (pass taskId as thread_id)
7. Update TasksService and DeliverablesService
8. Update extended-post-writer to use simplified state

### Session 3: Validation, Testing & Frontend
1. E2E tests for all decision types (using A2A endpoint consistently)
2. Error handling and edge cases
3. Create shared components (ContentViewer, ContentEditor, VersionSelector, etc.)
4. Create HitlReviewModal using shared components
5. Create DeliverablesModal using shared components
6. Create HitlPendingCard and DeliverableCard
7. Create HitlPendingList for sidebar
8. Implement auto-open behavior for modals
9. Implement deliverable visibility rules (hide pending HITL from "ready" list)
10. Manual testing and documentation

---

## Success Criteria

1. **Deliverables ARE versions**: No separate version tracking system
2. **API Runner owns HITL**: All decision logic centralized
3. **LangGraph is simple**: Just `interrupt()` and content generation
4. **Framework-agnostic**: N8N could use same API endpoints
5. **Uses existing infrastructure**: Minimal new columns (just `hitl_pending` on tasks, `task_id` on deliverables)
6. **All 5 decisions work**: APPROVE, REJECT, REGENERATE, REPLACE, SKIP tested
7. **Version history works**: Users see deliverable version history in modals
8. **Modal-based UI**: Single pane + modals, no two-pane layout
9. **HITL Pending List**: Sidebar shows all pending reviews (queries tasks table)
10. **Auto-open behavior**: Modals open automatically on response
11. **Cards persist**: HITL and Deliverable cards persist in conversation history
12. **Deliverable visibility**: Pending HITL deliverables hidden from "ready" list
13. **Future-proof**: Ready for multiple tasks per conversation

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `apps/api/supabase/migrations/YYYYMMDD_add_hitl_pending_to_tasks.sql` | Add hitl_pending to tasks, task_id to deliverables |
| `apps/langgraph/src/hitl/hitl-base.state.ts` | Simplified base state (taskId, no versions) |
| `apps/web/src/components/shared/ContentViewer.vue` | Markdown preview with tabs |
| `apps/web/src/components/shared/ContentEditor.vue` | Editable content areas |
| `apps/web/src/components/shared/VersionSelector.vue` | Version history list |
| `apps/web/src/components/shared/VersionBadge.vue` | Version type badge |
| `apps/web/src/components/shared/FeedbackInput.vue` | Regeneration feedback |
| `apps/web/src/components/hitl/HitlReviewModal.vue` | HITL review modal |
| `apps/web/src/components/hitl/HitlActionButtons.vue` | HITL action buttons |
| `apps/web/src/components/hitl/HitlPendingCard.vue` | Card in conversation |
| `apps/web/src/components/hitl/HitlPendingList.vue` | Sidebar pending list |
| `apps/web/src/components/deliverables/DeliverablesModal.vue` | Deliverables modal |
| `apps/web/src/components/deliverables/DeliverableActionButtons.vue` | Deliverable actions |
| `apps/web/src/components/deliverables/DeliverableCard.vue` | Card in conversation |

### Modified Files
| File | Changes |
|------|---------|
| `apps/transport-types/modes/hitl.types.ts` | Use `taskId`, add `HitlPendingItem` |
| `apps/api/src/agent2agent/services/agent-mode-router.service.ts` | Route HITL methods |
| `apps/api/src/agent2agent/services/api-agent-runner.service.ts` | Add HITL detection and handling |
| `apps/api/src/tasks/tasks.service.ts` | Add `setHitlPending`, `findPendingHitl` |
| `apps/api/src/agent2agent/deliverables/deliverables.service.ts` | Add `findByTaskId`, update `create` |
| `apps/langgraph/src/agents/extended-post-writer/*` | Use simplified state with taskId |
| `apps/web/src/services/hitlService.ts` | Use A2A JSON-RPC consistently |
| `apps/web/src/layouts/MainLayout.vue` | Add HitlPendingList to sidebar |

### Files Removed (from original plan)
| File | Reason |
|------|--------|
| ~~`HitlApprovalModal.vue`~~ | Replaced by `HitlReviewModal.vue` |
| ~~`HitlVersionSelector.vue`~~ | Replaced by shared `VersionSelector.vue` |
| ~~Two-pane layout code~~ | Replaced by modal-based architecture |

### No Changes Needed
| File | Reason |
|------|--------|
| `apps/api/src/agent2agent/deliverables/deliverable-versions.service.ts` | Already has version methods |
| `apps/web/src/services/deliverablesService.ts` | Already has version methods |

### Files NOT Created (Removed from Plan)
| File | Reason |
|------|--------|
| ~~`hitl.controller.ts`~~ | Use existing A2A endpoint instead |
| ~~`hitl.service.ts`~~ | Logic goes in API Runner |
| ~~`hitl.module.ts`~~ | No separate module needed |
| ~~`hitl_thread_states` migration~~ | Use task.hitl_pending instead |

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| How does deliverable get linked to task? | Add `task_id` column to deliverables table |
| What if task has no deliverable yet? | API Runner creates it on first HITL response |
| How to find deliverable for HITL resume? | Query by `task_id` |
| Where is HITL state stored? | `task.hitl_pending` + LangGraph checkpointer |
| Why use taskId instead of threadId? | Consistency - our system uses taskId, LangGraph uses it as thread_id internally |
| How to query pending HITL reviews? | Query tasks table where `hitl_pending = true` |
| Should pending HITL deliverables show as "ready"? | No - they show as "needs review" |
| Why task-level instead of conversation-level? | Future-proof for multiple tasks per conversation |
| Two-pane or single-pane? | Single pane + modals (better UX, mobile-friendly) |
| Multiple deliverables per conversation? | Ready for it (via task_id linkage) |
| How does LangGraph indicate interrupt? | `__interrupt__` array in response |
