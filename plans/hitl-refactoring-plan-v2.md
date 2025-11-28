# HITL Refactoring Plan v2: Deliverable-Centric Architecture

## Executive Summary

Refactor HITL (Human-in-the-Loop) to create a canonical, repeatable pattern for all workflow engines (LangGraph, N8N, CrewAI):

1. **Deliverables ARE the versions**: No separate version tracking - use existing `deliverables` + `deliverable_versions` tables
2. **API Runner owns all HITL logic**: Creates deliverables, handles decisions, resumes workflows
3. **Workflow engines are dumb**: They just generate content and report it - API Runner does the rest
4. **Framework-agnostic**: Same API endpoints work for LangGraph, N8N, or any future workflow engine
5. **Use existing A2A protocol**: No separate HITL controller - HITL methods handled via A2A endpoint
6. **Use `taskId` consistently**: No threadId/taskId confusion - `taskId` everywhere (LangGraph uses it as thread_id internally)
7. **No new tables**: LangGraph checkpointer stores HITL state, deliverables via conversation_id

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
```

---

## The Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HITL FLOW (Deliverable-Centric)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User sends message to API                                                │
│     └─→ API Runner receives request                                          │
│     └─→ API Runner calls LangGraph workflow                                  │
│                                                                              │
│  2. LangGraph generates content internally                                   │
│     └─→ LangGraph hits interrupt() / HITL pause                              │
│     └─→ LangGraph returns HITL response to API Runner                        │
│         { status: 'hitl_waiting', content: {blogPost, seo, etc}, taskId }    │
│                                                                              │
│  3. API Runner receives HITL response                                        │
│     └─→ API Runner creates Deliverable + Version 1                           │
│         (createdByType: AI_RESPONSE)                                         │
│     └─→ API Runner returns to Frontend:                                      │
│         { status: 'hitl_waiting', deliverable, taskId, ... }                 │
│                                                                              │
│  4. Frontend displays Deliverable for review                                 │
│     └─→ User sees content + version history                                  │
│                                                                              │
│  5. User makes decision, Frontend calls A2A endpoint                         │
│     ├─→ APPROVE: POST /:org/:agent/tasks {method: 'hitl.resume', ...}        │
│     │     └─→ API Runner resumes LangGraph (no new version needed)           │
│     │                                                                        │
│     ├─→ REGENERATE: {method: 'hitl.resume', decision: 'regenerate', ...}     │
│     │     └─→ API Runner resumes LangGraph with feedback                     │
│     │     └─→ LangGraph regenerates, hits interrupt() again                  │
│     │     └─→ API Runner creates Version 2 (AI_ENHANCEMENT)                  │
│     │     └─→ Returns to Frontend for another review                         │
│     │                                                                        │
│     └─→ REPLACE: {method: 'hitl.resume', decision: 'replace', content: {...}}│
│           └─→ API Runner creates Version 2 (MANUAL_EDIT)                     │
│           └─→ API Runner resumes LangGraph with user's content               │
│                                                                              │
│  6. Workflow completes                                                       │
│     └─→ LangGraph returns final response                                     │
│     └─→ Current deliverable version IS the final result                      │
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
}
```

### Switch 2: Response from LangGraph
```typescript
if (response.hitlPending) {
  // LangGraph called interrupt() - create deliverable version, return HITL response
  const deliverable = await this.createOrUpdateDeliverable(response, request);
  return buildHitlPendingResponse(response, deliverable);
} else {
  // Normal completion - return BUILD response with deliverable
  return buildBuildResponse(response, deliverable);
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
- `findOne()` - Get deliverable with current version

### DeliverableVersionsService Methods (Already Exists)
- `createVersion()` - Add new version (auto-increments, sets current)
- `getVersionHistory()` - All versions for deliverable
- `getCurrentVersion()` - Current version
- `setCurrentVersion()` - Promote older version
- `enhanceVersion()` - AI enhancement (regeneration)

---

## What We Need to Add

### 1. API Runner HITL Method Handling (via existing A2A endpoint)
Handle these methods in the mode router / API runner:
```typescript
switch (request.method) {
  case 'tasks/send':      // Normal BUILD/CONVERSE (existing)
  case 'hitl.resume':     // Resume with decision → calls LangGraph
  case 'hitl.status':     // Get status → reads LangGraph state
  case 'hitl.history':    // Get versions → reads deliverable versions
}
```
**No separate HITL controller needed** - use existing A2A endpoint.

### 2. API Runner HITL Logic
- Detect HITL response from LangGraph (hitlPending: true)
- Create deliverable on first HITL response
- Create versions on regeneration/replacement
- Resume LangGraph with decision
- Use `taskId` consistently (passed to LangGraph as thread_id)

### 3. HITL Transport Types Updates
- Keep `HitlDecision`, `HitlStatus`, etc.
- Update payload types to reference deliverables
- Use `taskId` instead of `threadId` in all types
- Remove workflow-specific version types

### 4. LangGraph Base State (Simplified)
- Use `taskId` (not threadId) in state
- HITL state fields (decision, feedback, pending)
- NO version tracking in state (API Runner handles it)
- NO direct DB access

### 5. No New Tables
- **No `hitl_thread_states` table** - LangGraph checkpointer stores HITL state
- Deliverable found via `conversation_id` from request
- Task status from LangGraph state

---

## Session Breakdown

### Session 1: Foundation
1. Update HITL transport types (use `taskId`, reference deliverables)
2. Create simplified HitlBaseStateAnnotation (use `taskId`, no versions)
3. Verify frontend hitlService.ts uses existing deliverablesService

### Session 2: API Runner Integration
1. Add HITL method routing in mode router (`hitl.resume`, `hitl.status`, `hitl.history`)
2. Implement HITL detection in API Runner (hitlPending response)
3. Implement deliverable creation on first HITL response
4. Implement resume handlers for each decision type
5. Wire up to LangGraph service (pass taskId as thread_id)

### Session 3: Validation & Testing + Frontend
1. E2E tests for all decision types
2. Error handling and edge cases
3. **Frontend: Create HitlVersionSelector component** (uses existing deliverablesService)
4. **Frontend: Update HitlApprovalModal with version history**
5. **Frontend: Add Regenerate button with feedback**
6. Manual testing and documentation

---

## Success Criteria

1. **Deliverables ARE versions**: No separate version tracking system
2. **API Runner owns HITL**: All decision logic centralized
3. **LangGraph is simple**: Just `interrupt()` and content generation
4. **Framework-agnostic**: N8N could use same API endpoints
5. **Uses existing infrastructure**: No new tables, minimal new services
6. **All 5 decisions work**: APPROVE, REJECT, REGENERATE, REPLACE, SKIP tested
7. **Version history works**: Users see deliverable version history in HITL modal
8. **Frontend integrated**: Version selector, version switching, regenerate with feedback

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `apps/langgraph/src/hitl/hitl-base.state.ts` | Simplified base state (taskId, no versions) |
| `apps/web/src/components/hitl/HitlVersionSelector.vue` | Version history selector component |

### Modified Files
| File | Changes |
|------|---------|
| `apps/transport-types/modes/hitl.types.ts` | Use `taskId`, reference deliverables |
| `apps/api/src/agent2agent/services/agent-mode-router.service.ts` | Route HITL methods |
| `apps/api/src/agent2agent/services/api-agent-runner.service.ts` | Add HITL detection and handling |
| `apps/langgraph/src/agents/extended-post-writer/*` | Use simplified state with taskId |
| `apps/web/src/components/hitl/HitlApprovalModal.vue` | Add version history, regenerate button |

### No Changes Needed
| File | Reason |
|------|--------|
| `apps/api/src/agent2agent/deliverables/*` | Already has everything we need |
| `apps/web/src/services/deliverablesService.ts` | Already has version methods |
| `apps/web/src/services/hitlService.ts` | Already uses A2A endpoint correctly |
| Database migrations | No new tables needed |

### Files NOT Created (Removed from Plan)
| File | Reason |
|------|--------|
| ~~`hitl.controller.ts`~~ | Use existing A2A endpoint instead |
| ~~`hitl.service.ts`~~ | Logic goes in API Runner |
| ~~`hitl.module.ts`~~ | No separate module needed |
| ~~`hitl_thread_states` migration~~ | Use LangGraph checkpointer instead |

---

## Migration from v1 Attempt

Files to remove (created during aborted v1 attempt):
- ~~`apps/api/supabase/migrations/20250128000001_create_workflow_content_versions.sql`~~ (deleted)
- ~~`apps/api/src/agent2agent/services/workflow-versions.service.ts`~~ (deleted)
- ~~`apps/api/src/agent2agent/services/workflow-versions.module.ts`~~ (deleted)

Transport types reverted:
- Removed `WorkflowVersionSource`, `WorkflowContentVersion`, `HitlPendingPayload`, etc.

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| How does deliverable get linked to conversation? | Deliverable already has `conversation_id` field |
| How does deliverable get linked to task? | Via `conversation_id` - task has conversation, deliverable has conversation |
| What if conversation has no deliverable yet? | API Runner creates it on first HITL response |
| How to find deliverable for HITL resume? | Query by `conversation_id` (from request params) |
| Where is HITL state stored? | LangGraph checkpointer (no separate table needed) |
| Why use taskId instead of threadId? | Consistency - our system uses taskId, LangGraph uses it as thread_id internally |
