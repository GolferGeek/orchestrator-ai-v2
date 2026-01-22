# Legal Department AI - Improvement Plan

**Document Created:** 2026-01-22
**Status:** Planning Complete - Ready for Implementation

---

## Overview

This document outlines the issues identified in the Legal Department AI agent and the agreed-upon solutions. These improvements focus on multi-agent coordination, user experience, and output quality.

---

## Implementation Groups

Issues are organized into groups for focused implementation. Each group has its own detailed document:

| Group | Document | Issues | Priority | Scope |
|-------|----------|--------|----------|-------|
| **A** | [legal-ai-group-a-multi-agent.md](./legal-ai-group-a-multi-agent.md) | #1, #2 | HIGH | LangGraph backend |
| **B** | [legal-ai-group-b-frontend-polish.md](./legal-ai-group-b-frontend-polish.md) | #4, #7, #8 | MEDIUM | Vue.js frontend |
| **C** | [legal-ai-group-c-progress-tracking.md](./legal-ai-group-c-progress-tracking.md) | #5 | MEDIUM | LangGraph + Vue.js |
| **D** | [legal-ai-group-d-audit-system.md](./legal-ai-group-d-audit-system.md) | #3 | MEDIUM | API + Vue.js |
| **E** | [legal-ai-group-e-low-priority.md](./legal-ai-group-e-low-priority.md) | #6, #9 | LOW | Verification + echo node |

**Recommended order:** A → B → C → D → E

---

## Issues & Solutions

### 1. Multi-Agent Coordination (Priority: HIGH)

**Problem:**
Test 10 (Multi-Issue Contract) failed because multi-agent mode is explicitly disabled. The CLO routing node has:
```typescript
// clo-routing.node.ts, line 405
const multiAgent = false;  // HARDCODED OFF
```

Even when a document has cross-domain concerns (Contract + Privacy + IP), only one specialist is invoked. The Contract specialist happened to catch the other issues, but this isn't reliable.

**Solution:**
- Enable multi-agent detection by setting `multiAgent = true`
- Ensure CLO routing logic correctly identifies documents needing multiple specialists
- When multiple specialists are needed, invoke them and merge results

**Files to Modify:**
- `apps/langgraph/src/agents/legal-department/nodes/clo-routing.node.ts`

---

### 2. Parallel Specialist Execution (Priority: HIGH)

**Problem:**
Even when multiple specialists run, they execute sequentially causing timeouts:
```typescript
// orchestrator.node.ts, lines 69-115
for (const specialistName of specialistsList) {
  const result = await specialist(currentState);  // ONE AT A TIME
}
```

This causes 30s + 30s + 30s = 90s execution time instead of max(30s, 30s, 30s) = 30s.

**Solution:**
- Change sequential `for...await` to parallel `Promise.all()`
- Keep specialist outputs separate by specialist name
- Merge into unified findings/risks/recommendations arrays for top-level results
- Executive summary synthesizes across all specialists

**Merging Strategy (V1):**
- Simple merge: Concatenate findings/risks/recommendations arrays from all specialists
- Accept potential duplicates (rare since specialists focus on different domains)
- Executive summary: Concatenate specialist summaries (add synthesis LLM call in V2 if needed)

**Implementation Pattern:**
```typescript
const results = await Promise.all(
  specialists.map(specialist => specialist(state))
);
// Then merge results
```

**Files to Modify:**
- `apps/langgraph/src/agents/legal-department/nodes/orchestrator.node.ts`

---

### 3. Audit System / HITL Controls (Priority: MEDIUM)

**Problem:**
- Current buttons: Approve / Request Changes / Escalate
- Clicking a button grays it out but provides no feedback
- "Escalate" purpose is unclear without a multi-tier review workflow
- No explicit "Reject" option
- Backend auto-approves (demo mode) - doesn't actually pause

**Solution (V1 - Post-hoc Audit Trail):**
- Change buttons to: **Approve** / **Reject** / **Request Re-analysis**
- Approve: Records "approved" + timestamp + user in audit trail
- Reject: Records "rejected" + timestamp + reason
- Request Re-analysis: Re-runs analysis with the comment as additional guidance
- Add visual feedback (toast/notification) when action is recorded
- No workflow pause needed - decisions recorded after analysis completes

**Backend Implementation:**
The audit trail is stored in `prediction.audit_logs` table. Add audit log creation in `handleHitlResume()` after successful HITL resume:
```typescript
// In handleHitlResume(), after sendHitlResume() returns successfully
if (result && !result.error) {
  await auditLogService.create({
    action: payload.decision, // 'approve', 'reject', 'request_reanalysis'
    resource_type: 'hitl_decision',
    resource_id: payload.taskId,
    user_id: resolveUserId(request),
    org_slug: organizationSlug,
    metadata: { agentSlug: definition.slug, feedback: payload.feedback }
  });
}
```

**Files to Modify:**
- `apps/web/src/views/agents/legal-department/components/HITLControls.vue`
- `apps/web/src/views/agents/legal-department/LegalDepartmentConversation.vue`
- `apps/web/src/views/agents/legal-department/legalDepartmentService.ts`
- `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts` (add audit log insert)

---

### 4. Executive Summary Markdown Rendering (Priority: MEDIUM)

**Problem:**
The Executive Summary displays raw markdown syntax instead of rendered content:
- `## Headings` shown as plain text
- `**bold**` shown as asterisks
- `| table |` syntax shown literally
- Checklist `- [ ]` items not rendered

**Solution:**
- Use `marked` library (already installed v15.0.11, used in `PlanDisplay.vue`)
- Apply markdown rendering to the Executive Summary section
- Style rendered HTML appropriately for the UI

**Implementation Pattern:**
```typescript
import { marked } from 'marked';
marked.setOptions({ breaks: true, gfm: true });
const renderedHtml = marked(summaryText);
```

**Files to Modify:**
- `apps/web/src/views/agents/legal-department/components/SynthesisPanel.vue`

---

### 5. Progress Tracking (Priority: MEDIUM)

**Problem:**
Progress is 100% fake client-side simulation:
- Hardcoded phases: `uploading (10%) → analyzing (50%) → completed (100%)`
- No real tracking of backend progress
- "Uploading document" shows longest but actual upload is quick
- Analysis phases flash by too fast

**Solution:**
- Add `observability.emitProgress()` calls to each LangGraph node
- Define meaningful milestones with realistic progress percentages:
  - `document_received`: 10%
  - `text_extracted`: 20%
  - `routing_complete`: 30%
  - `specialist_analyzing`: 40-80% (increment per specialist)
  - `synthesis_complete`: 90%
  - `report_generated`: 100%
- Frontend listens to these events and updates progress accordingly

**Infrastructure Status:** SSE pipeline is fully wired and operational:
```
LangGraph emitProgress() → POST /webhooks/status → WebhooksController
  → StreamingService.emitProgress() → EventEmitter → SSE stream → Frontend
```
No new wiring needed - just add emitProgress() calls to specialist nodes.

**Pattern from Other Agents:**
```typescript
await observability.emitProgress(ctx, taskId, "Analyzing contract terms...", {
  step: "contract_analysis",
  progress: 45,
  metadata: { specialist: "contract" }
});
```

**Files to Modify:**
- `apps/langgraph/src/agents/legal-department/nodes/*.node.ts` (all specialist nodes)
- `apps/langgraph/src/agents/legal-department/legal-department.graph.ts`
- `apps/web/src/views/agents/legal-department/LegalDepartmentConversation.vue`

---

### 6. PNG/Image Support (Priority: LOW - Verification Only)

**Problem:**
PNG support is implemented but untested. Need to verify it works end-to-end.

**Current Implementation:**
- UI accepts: PNG, JPG, JPEG, WEBP, GIF
- Backend uses Vision API (gpt-4-vision-preview) for text extraction
- OCR fallback if Vision fails
- Legal metadata extraction runs on extracted text

**Solution:**
- Test with Chrome MCP by uploading a PNG image of a contract
- Verify text extraction works
- Verify analysis runs correctly on extracted text
- Document any issues found

**Files (Reference Only):**
- `apps/web/src/views/agents/legal-department/components/DocumentUpload.vue`
- `apps/api/src/agent2agent/services/document-processing.service.ts`
- `apps/api/src/agent2agent/services/vision-extraction.service.ts`

---

### 7. PDF Export (Priority: MEDIUM)

**Problem:**
- Missing sections: CLO routing, contract overview, key clauses, metrics, key issues
- Risk severity CSS doesn't match (case sensitivity: `CRITICAL` vs `critical`)
- No page break handling (content splits across pages)
- Executive summary shows raw markdown
- Doesn't match what's shown on screen
- **NEW**: Multi-agent mode produces multiple specialist tabs - PDF must capture ALL

**Solution: Executive Summary + Appendices (Option D)**

With multi-agent mode enabled, the PDF must capture all specialist outputs:

```
PART 1: EXECUTIVE OVERVIEW
==========================
1. Header (Document name, timestamp, Overall Risk Level)
2. CLO Routing Summary (All specialists, confidence)
3. Aggregated Metrics (Total Findings/Risks/Recommendations/Specialists)
4. Risk Breakdown (Critical/High/Medium/Low bar chart)
5. Key Issues (Combined from all specialists)
6. Executive Summary (RENDERED markdown)

PART 2: SPECIALIST APPENDICES
=============================
For each specialist invoked:
- Appendix A: Contract Analysis (overview, risks, clauses)
- Appendix B: IP Analysis (overview, risks)
- Appendix C: Privacy Analysis (overview, regulatory flags)
- Appendix D: Compliance Analysis (policy checks)
- Appendix E: Employment Analysis (restrictive covenants)
(etc. for Corporate, Litigation, Real Estate)

FOOTER: Page numbers, timestamp, "Generated by Legal Department AI"
```

**Implementation:**
1. Iterate over `specialistOutputs` to generate appendices
2. Add Table of Contents when 2+ specialists
3. Add `.toLowerCase()` to severity class
4. Add `page-break-inside: avoid` for content sections
5. Render markdown with `marked()` library

**Files to Modify:**
- `apps/web/src/views/agents/legal-department/LegalDepartmentConversation.vue` (exportToPdf function)

---

### 8. Analysis Options Checkboxes (Priority: LOW)

**Problem:**
UI has three checkboxes that do nothing:
- Extract Key Terms
- Identify Risks
- Generate Recommendations

Backend completely ignores these options. All analysis always runs regardless of checkbox state.

**Solution:**
- Remove the checkboxes from the UI
- Legal analysis should always be comprehensive
- Simplifies the interface

**Files to Modify:**
- `apps/web/src/views/agents/legal-department/components/DocumentUpload.vue`

---

### 9. Non-Document Legal Questions (Priority: LOW)

**Problem:**
When asking a legal question without a document:
- Just a basic LLM call with generic prompt
- No RAG or knowledge base
- No legal research capability
- Still takes 3-11 seconds due to LLM latency

**Solution (V1 - Smarter Prompting):**
- Improve the system prompt in echo node
- Add legal reasoning frameworks
- Include common legal definitions
- Structure responses with citations to general principles
- Acknowledge limitations when appropriate

**Solution (V2 - Future - RAG):**
- Build curated legal knowledge base
- User will work on content sourcing separately
- Integrate with existing RAG infrastructure

**Files to Modify (V1):**
- `apps/langgraph/src/agents/legal-department/nodes/echo.node.ts`

---

## Implementation Order

| Priority | Issue | Effort | Dependencies |
|----------|-------|--------|--------------|
| 1 | Multi-agent coordination | Medium | None |
| 2 | Parallel specialist execution | Medium | #1 |
| 3 | Progress tracking | Medium | None |
| 4 | Executive summary markdown | Low | None |
| 5 | PDF export fixes | Medium | #4 (markdown) |
| 6 | Audit system buttons | Low | None |
| 7 | Remove analysis checkboxes | Low | None |
| 8 | PNG support verification | Low | None |
| 9 | Non-doc question prompting | Low | None |

---

## Testing Plan

Each fix should be verified with Chrome MCP browser testing:

1. **Multi-agent + Parallel**: Upload TEST-10-multi-issue.md, verify multiple specialists run ✅ VERIFIED
2. **Progress tracking**: Upload any document, watch progress bar update realistically
3. **Markdown**: Check Executive Summary renders properly
4. **PDF export (single)**: Upload simple document, verify Executive Overview + single Appendix
5. **PDF export (multi)**: Upload TEST-10-multi-issue.md, verify:
   - Part 1: Executive Overview with aggregated metrics
   - Part 2: All 5 specialist appendices (A-E)
   - Table of Contents present
   - Page breaks between appendices
6. **Audit buttons**: Click Approve/Reject, verify feedback shown
7. **PNG support**: Upload a PNG image of a contract, verify analysis works
8. **Non-doc questions**: Ask a legal question, verify improved response quality

---

## Files Summary

**LangGraph (Backend):**
- `apps/langgraph/src/agents/legal-department/nodes/clo-routing.node.ts`
- `apps/langgraph/src/agents/legal-department/nodes/orchestrator.node.ts`
- `apps/langgraph/src/agents/legal-department/nodes/echo.node.ts`
- `apps/langgraph/src/agents/legal-department/nodes/*.node.ts` (all specialists)

**API (Backend):**
- `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts`

**Web (Frontend):**
- `apps/web/src/views/agents/legal-department/LegalDepartmentConversation.vue`
- `apps/web/src/views/agents/legal-department/components/HITLControls.vue`
- `apps/web/src/views/agents/legal-department/components/SynthesisPanel.vue`
- `apps/web/src/views/agents/legal-department/components/DocumentUpload.vue`
- `apps/web/src/views/agents/legal-department/legalDepartmentService.ts`

---

## Notes

- Multi-agent and parallel execution are the highest priority as they affect reliability and prevent timeouts
- Executive summary markdown fix will also improve PDF export (same rendering needed)
- RAG integration deferred to V2 - user will source legal knowledge base content
- All changes should maintain the existing A2A protocol and ExecutionContext capsule pattern
