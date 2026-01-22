# Legal Department AI - Group D: Audit System

**Priority:** MEDIUM
**Issue:** #3 (Audit System / HITL Controls)
**Scope:** Vue.js frontend + NestJS API backend

---

## Overview

Improve the HITL (Human-in-the-Loop) controls with clearer button labels, add visual feedback, and create an audit trail for decisions.

---

## Issue #3: Audit System / HITL Controls

### Problem

- Current buttons: Approve / Request Changes / Escalate
- Clicking a button grays it out but provides no feedback
- "Escalate" purpose is unclear without a multi-tier review workflow
- No explicit "Reject" option
- Backend auto-approves (demo mode) - doesn't actually pause

### Solution (V1 - Post-hoc Audit Trail)

- Change buttons to: **Approve** / **Reject** / **Request Re-analysis**
- Approve: Records "approved" + timestamp + user in audit trail
- Reject: Records "rejected" + timestamp + reason
- Request Re-analysis: Re-runs analysis with the comment as additional guidance
- Add visual feedback (toast/notification) when action is recorded
- No workflow pause needed - decisions recorded after analysis completes

---

## Frontend Changes

### Button Labels

Change from:
```
[ Approve ] [ Request Changes ] [ Escalate ]
```

To:
```
[ Approve ] [ Reject ] [ Request Re-analysis ]
```

### Visual Feedback

Add toast/notification when action is recorded:
- Success: "Decision recorded: Approved" (green)
- Success: "Decision recorded: Rejected" (red)
- Info: "Re-analysis requested" (blue)

### Files to Modify

- `apps/web/src/views/agents/legal-department/components/HITLControls.vue` - button labels and styling
- `apps/web/src/views/agents/legal-department/LegalDepartmentConversation.vue` - toast notifications
- `apps/web/src/views/agents/legal-department/legalDepartmentService.ts` - update decision values sent to backend

---

## Backend Changes

### Audit Trail Storage

The audit trail is stored in `prediction.audit_logs` table with fields:
- `action`: 'approve', 'reject', 'request_reanalysis'
- `resource_type`: 'hitl_decision'
- `resource_id`: taskId
- `user_id`: from request context
- `org_slug`: organization slug
- `changes`: null (not applicable)
- `metadata`: { agentSlug, feedback }
- `created_at`: auto-generated timestamp

### Implementation Location

Add audit log creation in `handleHitlResume()` after successful HITL resume:

```typescript
// File: apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts
// In handleHitlResume(), around line 232, after sendHitlResume() returns successfully

const result = await sendHitlResume(definition, request, services);

// ADD AUDIT LOG HERE
if (result && !result.error) {
  const userId = resolveUserId(request);
  await auditLogService.create({
    action: payload.decision, // 'approve', 'reject', 'request_reanalysis'
    resource_type: 'hitl_decision',
    resource_id: payload.taskId,
    user_id: userId,
    org_slug: organizationSlug,
    metadata: {
      agentSlug: definition.slug,
      feedback: payload.feedback,
    }
  });
}
```

### Dependencies Needed

- Inject `AuditLogService` into `HitlHandlerDependencies`
- Or use Supabase client directly if AuditLogService not available

### File to Modify

- `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts`

---

## API Flow

```
Frontend recordHITLDecision()
  → POST /agent-to-agent/{orgSlug}/{agentSlug}/tasks
    (mode: 'hitl', method: 'hitl.resume')
  → AgentModeRouterService.routeHitlMethod()
  → API Runner
  → hitl.handlers.ts → handleHitlResume()
  → sendHitlResume() to LangGraph
  → [NEW] Create audit_logs entry
  → Return success response
  → Frontend shows toast notification
```

---

## Files to Modify Summary

**Frontend:**
- `apps/web/src/views/agents/legal-department/components/HITLControls.vue`
- `apps/web/src/views/agents/legal-department/LegalDepartmentConversation.vue`
- `apps/web/src/views/agents/legal-department/legalDepartmentService.ts`

**Backend:**
- `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts`

---

## Dependencies

- No dependencies on other issues
- Requires `prediction.audit_logs` table to exist (already exists)
- Requires HITL columns on task table (already exist: `hitl_pending`, `hitl_pending_since`)

---

## Testing Plan

1. Upload a document and wait for analysis to complete
2. Click **Approve** button:
   - Verify toast notification appears: "Decision recorded: Approved"
   - Verify button state updates appropriately
   - Query `prediction.audit_logs` to verify entry created with action='approve'

3. Upload another document
4. Click **Reject** button:
   - Verify toast notification appears: "Decision recorded: Rejected"
   - Verify audit_logs entry with action='reject'

5. Upload another document
6. Click **Request Re-analysis** with a comment:
   - Verify toast notification appears: "Re-analysis requested"
   - Verify audit_logs entry with action='request_reanalysis' and feedback in metadata
   - Verify re-analysis runs with the comment as guidance (if implemented)

---

## Database Schema Reference

```sql
-- prediction.audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR NOT NULL,
  resource_type VARCHAR NOT NULL,
  resource_id VARCHAR NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  org_slug VARCHAR NOT NULL,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
