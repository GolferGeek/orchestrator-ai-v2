# Legal Department AI - Group A: Multi-Agent & Parallel Execution

**Priority:** HIGH
**Issues:** #1 (Multi-Agent Coordination) + #2 (Parallel Specialist Execution)
**Scope:** LangGraph backend only

---

## Overview

Enable the Legal Department AI to route documents to multiple specialists when cross-domain concerns exist, and execute those specialists in parallel to prevent timeouts.

---

## Issue #1: Multi-Agent Coordination

### Problem

Test 10 (Multi-Issue Contract) failed because multi-agent mode is explicitly disabled. The CLO routing node has:
```typescript
// clo-routing.node.ts, line 405
const multiAgent = false;  // HARDCODED OFF
```

Even when a document has cross-domain concerns (Contract + Privacy + IP), only one specialist is invoked. The Contract specialist happened to catch the other issues, but this isn't reliable.

### Solution

- Enable multi-agent detection by setting `multiAgent = true`
- Ensure CLO routing logic correctly identifies documents needing multiple specialists
- When multiple specialists are needed, invoke them and merge results

### File to Modify

- `apps/langgraph/src/agents/legal-department/nodes/clo-routing.node.ts`

---

## Issue #2: Parallel Specialist Execution

### Problem

Even when multiple specialists run, they execute sequentially causing timeouts:
```typescript
// orchestrator.node.ts, lines 69-115
for (const specialistName of specialistsList) {
  const result = await specialist(currentState);  // ONE AT A TIME
}
```

This causes 30s + 30s + 30s = 90s execution time instead of max(30s, 30s, 30s) = 30s.

### Solution

- Change sequential `for...await` to parallel `Promise.all()`
- Keep specialist outputs separate by specialist name
- Merge into unified findings/risks/recommendations arrays for top-level results
- Executive summary synthesizes across all specialists

### Merging Strategy (V1)

- Simple merge: Concatenate findings/risks/recommendations arrays from all specialists
- Accept potential duplicates (rare since specialists focus on different domains)
- Executive summary: Concatenate specialist summaries (add synthesis LLM call in V2 if needed)

### Implementation Pattern

```typescript
const results = await Promise.all(
  specialists.map(specialist => specialist(state))
);

// Merge results
const mergedFindings = results.flatMap(r => r.findings || []);
const mergedRisks = results.flatMap(r => r.risks || []);
const mergedRecommendations = results.flatMap(r => r.recommendations || []);
const combinedSummary = results.map(r => r.summary).filter(Boolean).join('\n\n---\n\n');
```

### File to Modify

- `apps/langgraph/src/agents/legal-department/nodes/orchestrator.node.ts`

---

## Dependencies

- Issue #2 depends on Issue #1 (parallel execution only matters if multiple specialists are selected)
- No external dependencies

---

## Testing Plan

1. Upload `TEST-10-multi-issue.md` (5.7 KB file with intentional multi-domain issues: contract + privacy + IP)
2. Verify CLO routing selects multiple specialists
3. Verify specialists execute in parallel (check timing - should be ~30s not 90s)
4. Verify merged results contain findings from all specialists
5. Verify executive summary includes content from all specialists

---

## Architecture Notes

- Maintain existing A2A protocol and ExecutionContext capsule pattern
- Specialist nodes should remain unchanged - only orchestrator changes how they're invoked
- State shape should remain compatible with single-specialist flow
