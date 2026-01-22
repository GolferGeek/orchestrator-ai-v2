# Legal Department AI - Group C: Progress Tracking

**Priority:** MEDIUM
**Issue:** #5 (Progress Tracking)
**Scope:** LangGraph backend + Vue.js frontend

---

## Overview

Replace fake client-side progress simulation with real backend progress events using the existing SSE infrastructure.

---

## Issue #5: Progress Tracking

### Problem

Progress is 100% fake client-side simulation:
- Hardcoded phases: `uploading (10%) → analyzing (50%) → completed (100%)`
- No real tracking of backend progress
- "Uploading document" shows longest but actual upload is quick
- Analysis phases flash by too fast

### Solution

- Add `observability.emitProgress()` calls to each LangGraph node
- Define meaningful milestones with realistic progress percentages
- Frontend listens to these events and updates progress accordingly

---

## Progress Milestones

| Step | Progress % | Message | Node |
|------|------------|---------|------|
| `document_received` | 10% | "Document received" | Entry node |
| `text_extracted` | 20% | "Text extracted from document" | Document processing |
| `routing_complete` | 30% | "Routing to specialist(s)..." | CLO routing |
| `specialist_analyzing` | 40-80% | "Analyzing with {specialist}..." | Each specialist |
| `synthesis_complete` | 90% | "Synthesizing findings..." | Synthesis node |
| `report_generated` | 100% | "Report complete" | Final node |

For multiple specialists, divide the 40-80% range:
- 1 specialist: 40% → 80%
- 2 specialists: 40% → 60% → 80%
- 3 specialists: 40% → 53% → 67% → 80%

---

## Infrastructure Status

SSE pipeline is fully wired and operational:
```
LangGraph emitProgress()
  → POST /webhooks/status
  → WebhooksController
  → StreamingService.emitProgress()
  → EventEmitter
  → SSE stream
  → Frontend
```

**No new wiring needed** - just add emitProgress() calls to specialist nodes.

---

## Implementation Pattern

From other agents in the codebase:
```typescript
await observability.emitProgress(ctx, taskId, "Analyzing contract terms...", {
  step: "contract_analysis",
  progress: 45,
  metadata: { specialist: "contract" }
});
```

### Backend Changes

Add to each node that represents a milestone:

```typescript
// In clo-routing.node.ts - after routing decision
await observability.emitProgress(ctx, taskId, `Routing to ${selectedSpecialists.join(', ')}...`, {
  step: "routing_complete",
  progress: 30,
  metadata: { specialists: selectedSpecialists }
});

// In each specialist node - at start of analysis
await observability.emitProgress(ctx, taskId, `Analyzing with ${specialistName}...`, {
  step: "specialist_analyzing",
  progress: calculateProgress(index, total), // 40-80% range
  metadata: { specialist: specialistName }
});

// In synthesis node - after synthesis complete
await observability.emitProgress(ctx, taskId, "Synthesizing findings...", {
  step: "synthesis_complete",
  progress: 90,
  metadata: {}
});
```

### Frontend Changes

Update `LegalDepartmentConversation.vue` to:
1. Remove fake progress simulation
2. Listen to SSE progress events
3. Update progress bar based on real `progress` values from events

```typescript
// Remove fake simulation like:
// setTimeout(() => progress.value = 50, 1000);

// Instead, handle SSE events:
sseService.onProgress((event) => {
  if (event.taskId === currentTaskId) {
    progress.value = event.progress;
    progressMessage.value = event.message;
  }
});
```

---

## Files to Modify

**LangGraph (Backend):**
- `apps/langgraph/src/agents/legal-department/nodes/clo-routing.node.ts`
- `apps/langgraph/src/agents/legal-department/nodes/orchestrator.node.ts`
- `apps/langgraph/src/agents/legal-department/nodes/*.node.ts` (specialist nodes)
- `apps/langgraph/src/agents/legal-department/legal-department.graph.ts` (if entry/exit points need progress)

**Web (Frontend):**
- `apps/web/src/views/agents/legal-department/LegalDepartmentConversation.vue`

---

## Dependencies

- No dependencies on other issues
- Can be implemented independently
- Infrastructure is already in place

---

## Testing Plan

1. Upload any document
2. Watch progress bar update in real-time
3. Verify progress milestones match actual backend processing:
   - 10% when document received
   - 20% after text extraction
   - 30% after routing
   - 40-80% during specialist analysis (should see increments)
   - 90% during synthesis
   - 100% when complete
4. Verify progress messages are descriptive and accurate
5. Test with multi-specialist document to verify progress increments correctly

---

## Architecture Notes

- Use `observability` service already available in LangGraph nodes
- Progress events include `taskId` for correlation
- Frontend already has SSE connection for streaming - just need to handle progress event type
