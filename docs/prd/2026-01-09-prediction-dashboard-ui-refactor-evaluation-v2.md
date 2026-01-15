# PRD Evaluation v2: Prediction Dashboard UI Refactor

**Date:** January 9, 2026  
**Evaluator:** AI Code Review  
**PRD:** `2026-01-09-prediction-dashboard-ui-refactor.md`  
**Previous Evaluation:** `2026-01-09-prediction-dashboard-ui-refactor-evaluation.md`

---

## Executive Summary

The PRD has been **significantly improved** with the addition of comprehensive appendices addressing most critical issues. However, there are still **several important inconsistencies** and **missing implementation details** that need attention before coding begins.

**Overall Assessment:** ✅ **92% Complete** - Much better, but still needs refinement

**Status:** Ready for implementation after addressing remaining issues

---

## 1. Critical Issues Fixed ✅

### ✅ Fixed: Handler Pattern
- **Status:** RESOLVED
- Section 8.2 now correctly shows `IDashboardHandler` interface pattern
- Matches existing `UniverseHandler` implementation
- Properly integrated with `PredictionDashboardRouter`

### ✅ Fixed: Transport Types Usage
- **Status:** RESOLVED  
- Section 8.2 imports from `@orchestrator-ai/transport-types`
- Uses `ExecutionContext` and `DashboardRequestPayload` correctly

### ✅ Fixed: Analyst Config Structure
- **Status:** RESOLVED
- Migration script (Section 9.3) now correctly maps only `perspective` and `default_weight`
- Schema definition (Section 9.1) matches migration script

### ✅ Fixed: Agent-Domain Relationship
- **Status:** RESOLVED
- Appendix G provides comprehensive explanation
- Clarifies multi-domain support through universes

### ✅ Fixed: Error Handling
- **Status:** RESOLVED
- Appendix D provides complete error handling specifications
- Error codes, response structure, and Vue component patterns documented

### ✅ Fixed: TypeScript Interfaces
- **Status:** RESOLVED
- Appendix C provides comprehensive type definitions
- Includes enums, interfaces, and component props

### ✅ Fixed: RLS Policies
- **Status:** RESOLVED
- Appendix E provides RLS policy examples
- Covers organization-based access control

### ✅ Fixed: Testing Strategy
- **Status:** RESOLVED
- Appendix F provides comprehensive testing approach
- Unit, integration, component, and E2E tests covered

---

## 2. Remaining Critical Issues ⚠️

### 2.1 ❌ CRITICAL: Frontend Service Endpoint Mismatch

**Issue:** Section 8.1 shows incorrect endpoint pattern:
```typescript
// PRD shows:
const response = await apiService.post<A2AResponse<T>>('/a2a/task', {
  jsonrpc: '2.0',
  method,
  params,
  id: generateId()
});
```

**Actual Pattern** (from `predictionDashboardService.ts`):
```typescript
// Should be:
const endpoint = `/agent-to-agent/${org}/${agentSlug}/tasks`;
const request = {
  jsonrpc: '2.0',
  id: crypto.randomUUID(),
  method: `dashboard.${action}`,
  params: {
    mode: 'dashboard',
    payload: { action, params, filters, pagination },
    context: executionContext
  }
};
```

**Location:** Section 8.1, lines 1029-1037

**Impact:** Frontend service won't work - wrong endpoint and request structure

**Fix Required:**
- Update `callTask` method to use correct endpoint pattern
- Include `mode: 'dashboard'` in params
- Wrap params in `payload` object
- Include `context` from execution context store

### 2.2 ❌ CRITICAL: Method Name Inconsistency

**Issue:** Section 8.1 shows methods like:
- `dashboard.contexts.getHierarchy`
- `dashboard.contexts.list`
- `dashboard.contexts.getEffective`

But Section 8.2 handler shows actions like:
- `gethierarchy` (lowercase, no dots)
- `list`
- `geteffective`

**Location:** Section 8.1 vs Section 8.2

**Impact:** Router will fail to match methods to actions

**Fix Required:**
- Document that router extracts `operation` from `dashboard.<entity>.<operation>`
- Show that `dashboard.contexts.getHierarchy` → entity=`contexts`, operation=`getHierarchy`
- Handler receives `action='getHierarchy'` (camelCase)

### 2.3 ⚠️ MEDIUM: Missing Organization Slug in Contexts Table

**Issue:** Section 9.1 schema doesn't include `organization_slug` column, but:
- Section 8.2 handler passes `context.orgSlug` to service
- Appendix E RLS policies reference `organization_slug` column
- Migration script doesn't set organization

**Location:** Section 9.1, Section 8.2, Appendix E

**Impact:** RLS policies won't work, multi-tenant isolation fails

**Fix Required:**
- Add `organization_slug TEXT NOT NULL` to schema
- Update migration script to set organization from universe or default
- Or document that organization is derived through universe joins

---

## 3. Consistency Issues

### 3.1 Method Naming Pattern

**Issue:** Inconsistent method naming:
- Section 8.1: `dashboard.contexts.getHierarchy` (camelCase operation)
- Section 13.1: Same pattern
- Section 8.2: Handler receives `getHierarchy` (camelCase)

But existing router (from codebase) uses:
- `dashboard.universes.list` → action=`list` (lowercase)
- Router normalizes to lowercase: `action.toLowerCase()`

**Location:** Section 8.1, Section 8.2, Section 13.1

**Recommendation:**
- Document that router normalizes action names to lowercase
- Update handler examples to use lowercase: `case 'gethierarchy':`
- Or update router documentation to show camelCase support

### 3.2 Tier Content Fallback Chain

**Issue:** Section 9.2 function shows fallback:
```sql
COALESCE(
  c.tier_content->>p_tier,
  c.tier_content->>'default',
  c.tier_content->>'silver'
)
```

But Section 3.4 doesn't mention `default` field, and Appendix C shows `TierContent` interface without `default`:

```typescript
export interface TierContent {
  gold?: string;
  silver?: string;
  bronze?: string;
}
```

**Location:** Section 3.4, Section 9.2, Appendix C.1

**Recommendation:**
- Add `default?: string` to `TierContent` interface in Appendix C
- Or remove `default` from SQL fallback and use `silver` as default
- Document the fallback chain explicitly

### 3.3 Context Service Method Signature

**Issue:** Section 8.2 shows:
```typescript
const { items, total } = await this.contextService.findByScope(
  context.orgSlug,
  scopeLevel,
  scopeId,
  contextType,
  pagination
);
```

But this implies `findByScope` returns `{ items, total }`, which should be documented.

**Location:** Section 8.2

**Recommendation:**
- Document `ContextService` interface in Appendix C or create separate service docs
- Show return type: `Promise<{ items: Context[], total: number }>`

---

## 4. Missing Implementation Details

### 4.1 Frontend Service Context Injection

**Issue:** Section 8.1 doesn't show how to get `ExecutionContext`:
- Where does `context` come from?
- How is `orgSlug` obtained?
- How is `userId` obtained?

**Location:** Section 8.1

**Recommendation:**
- Show import: `import { useExecutionContextStore } from '@/stores/executionContext'`
- Show context retrieval: `const ctx = useExecutionContextStore().current`
- Or show using `getContext()` helper like existing service

### 4.2 Pagination Implementation

**Issue:** Section 8.2 shows pagination parameter but doesn't specify:
- Default page size
- Maximum page size
- How pagination metadata is returned

**Location:** Section 8.2

**Recommendation:**
- Document default: `pageSize: 20`
- Document max: `pageSize: 100`
- Show pagination metadata structure matches `DashboardActionResult.metadata`

### 4.3 Context Hierarchy Structure

**Issue:** Section 8.1 shows `getContextHierarchy()` returns `ContextHierarchy`, but:
- Appendix C.2 shows `ContextHierarchyNode` interface
- Doesn't show root structure (array? single node?)
- Doesn't show how to build tree from flat response

**Location:** Section 8.1, Appendix C.2

**Recommendation:**
- Document return type: `Promise<ContextHierarchyNode[]>` (array of root nodes)
- Show example response structure
- Document tree-building logic or show helper function

### 4.4 Learning Queue Handler Integration

**Issue:** Section 8.1 shows `dashboard.learningQueue.list` but:
- Router already has `LearningQueueHandler` (from codebase)
- Doesn't show if new handler needed or existing one extended
- Doesn't show `approveAsContext` action implementation

**Location:** Section 8.1, Section 8.2

**Recommendation:**
- Document that `LearningQueueHandler` needs new `approveAsContext` action
- Show handler method implementation
- Or create separate `ContextLearningQueueHandler` if needed

---

## 5. Database Schema Issues

### 5.1 Missing Organization Slug Column

**Issue:** Schema doesn't include `organization_slug` but RLS policies require it.

**Location:** Section 9.1, Appendix E

**Recommendation:**
- Add column: `organization_slug TEXT NOT NULL`
- Add index: `CREATE INDEX idx_contexts_org ON prediction.contexts(organization_slug)`
- Update migration to set from universe or user context

### 5.2 Missing Created/Updated By Fields

**Issue:** Schema has timestamps but no audit fields:
- `created_by UUID REFERENCES public.users(id)`
- `updated_by UUID REFERENCES public.users(id)`

**Location:** Section 9.1

**Recommendation:**
- Add audit fields for compliance
- Or document that audit trail is through `source_learning_id` and timestamps

### 5.3 Composite Index Missing

**Issue:** Common query pattern `(context_type, scope_level, domain)` not indexed.

**Location:** Section 9.1

**Recommendation:**
- Add: `CREATE INDEX idx_contexts_type_scope_domain ON prediction.contexts(context_type, scope_level, domain) WHERE domain IS NOT NULL`

---

## 6. Component Architecture Gaps

### 6.1 Missing Pinia Store Structure

**Issue:** Section 10.1 shows components but no store:
- Where is context data cached?
- How is hierarchy state managed?
- How are loading states handled?

**Location:** Section 10.1

**Recommendation:**
- Add store structure: `usePredictionContextStore`
- Show state: `contexts: Map<string, Context>`, `hierarchy: ContextHierarchyNode[]`
- Show actions: `loadHierarchy()`, `loadContexts(scope)`, `createContext()`

### 6.2 Missing Component Communication Patterns

**Issue:** Components reference each other but patterns not documented:
- How does `ContextNavigator` communicate selection to `ContextList`?
- How does `ContextEditor` save and notify parent?
- Event bus? Props? Store?

**Location:** Section 5

**Recommendation:**
- Document: Use Pinia store for shared state
- Document: Use `provide/inject` for scope context
- Document: Use events for user actions (edit, delete)

### 6.3 Missing Loading States

**Issue:** Components don't show loading indicators:
- `ContextNavigator` loading hierarchy
- `ContextList` loading contexts
- `ContextEditor` saving

**Location:** Section 5

**Recommendation:**
- Add loading state examples to component code
- Show skeleton loaders or spinners
- Document loading state management

---

## 7. API Request/Response Format Issues

### 7.1 Request Payload Structure Mismatch

**Issue:** Section 8.1 service shows:
```typescript
return this.callTask('dashboard.contexts.list', params);
```

But should be:
```typescript
return this.callTask('contexts.list', {
  params: { ... },
  filters: { scopeLevel, scopeId, contextType },
  pagination: { page, pageSize }
});
```

**Location:** Section 8.1

**Recommendation:**
- Update all service methods to use correct payload structure
- Show `filters` and `pagination` as separate parameters
- Match existing `predictionDashboardService.ts` pattern

### 7.2 Response Structure

**Issue:** Section 8.1 shows `return response.result` but:
- Handler returns `DashboardActionResult` with `{ success, data, metadata }`
- Router wraps in `DashboardRouterResponse`
- Final response structure unclear

**Location:** Section 8.1, Section 8.2

**Recommendation:**
- Document full response chain: Handler → Router → JSON-RPC → Frontend
- Show example response: `{ jsonrpc: '2.0', id: '...', result: { success: true, data: [...], metadata: {...} } }`
- Show how frontend extracts `data` from response

---

## 8. Documentation Improvements Needed

### 8.1 Missing Migration Rollback

**Issue:** Appendix A mentions migration but no rollback procedure.

**Location:** Appendix A

**Recommendation:**
- Add rollback SQL script
- Document backup creation before migration
- Add verification steps

### 8.2 Missing Performance Benchmarks

**Issue:** Section 14 has targets but no baseline measurements.

**Location:** Section 14

**Recommendation:**
- Add current performance baselines
- Show how targets were determined
- Add monitoring/alerting thresholds

### 8.3 Missing Edge Cases

**Issue:** Doesn't cover:
- What if universe has no targets?
- What if all contexts are inactive?
- What if tier content is empty for all tiers?
- What if user tries to create duplicate slug?

**Location:** Throughout

**Recommendation:**
- Add edge cases section
- Document handling for each case
- Add validation rules

---

## 9. Positive Improvements ✅

### Excellent Additions:
1. ✅ **Comprehensive Appendices** - All major gaps addressed
2. ✅ **TypeScript Interfaces** - Complete type definitions
3. ✅ **Error Handling** - Detailed error codes and patterns
4. ✅ **RLS Policies** - Security properly documented
5. ✅ **Testing Strategy** - Complete test coverage plan
6. ✅ **Agent-Domain Relationship** - Clear explanation

### Well-Structured:
- Clear component hierarchy
- Good database schema design
- Proper handler pattern alignment
- Comprehensive API documentation

---

## 10. Recommendations Summary

### Must Fix Before Implementation (Critical):
1. ❌ **Fix frontend service endpoint** (Section 8.1) - Wrong endpoint pattern
2. ❌ **Fix method naming consistency** (Section 8.1 vs 8.2) - Document router normalization
3. ⚠️ **Add organization_slug to schema** (Section 9.1) - Required for RLS

### Should Fix During Planning (High Priority):
4. Add Pinia store structure documentation
5. Document request/response format completely
6. Add loading state examples to components
7. Document context hierarchy response structure
8. Add edge cases documentation

### Nice to Have (Low Priority):
9. Add migration rollback procedures
10. Add performance baselines
11. Add component communication diagram
12. Add audit fields to schema (if required)

---

## 11. Comparison to Previous Evaluation

### Issues Resolved: ✅
- Handler pattern ✅
- Transport types ✅
- Analyst config ✅
- Agent-domain relationship ✅
- Error handling ✅
- TypeScript interfaces ✅
- RLS policies ✅
- Testing strategy ✅

### New Issues Found:
- Frontend service endpoint mismatch (critical)
- Method naming inconsistency (critical)
- Missing organization_slug in schema (medium)
- Missing Pinia store documentation
- Request/response format gaps

### Overall Progress:
- **Previous:** 85% complete, 3 critical issues
- **Current:** 92% complete, 2 critical issues, 1 medium issue
- **Improvement:** +7% completeness, -1 critical issue

---

## Conclusion

The PRD has been **significantly improved** with comprehensive appendices addressing most critical concerns. The remaining issues are primarily **implementation detail gaps** rather than architectural problems.

**Recommended Next Steps:**
1. Fix the 2 critical issues (endpoint pattern, method naming)
2. Add organization_slug to schema
3. Add Pinia store documentation
4. Complete request/response format documentation
5. Review with team and proceed to implementation

**Estimated Fix Time:** 2-4 hours  
**Ready for Implementation:** After critical fixes applied

---

## Appendix: Quick Fix Checklist

### Critical Fixes (Do First):
- [ ] Update Section 8.1 `callTask` method to use `/agent-to-agent/${org}/${agentSlug}/tasks`
- [ ] Update Section 8.1 to include `mode: 'dashboard'` and `payload` wrapper
- [ ] Document router action normalization (lowercase vs camelCase)
- [ ] Add `organization_slug TEXT NOT NULL` to Section 9.1 schema
- [ ] Update migration script to set organization_slug

### High Priority Fixes:
- [ ] Add Pinia store structure to Section 10 or new appendix
- [ ] Document complete request/response format with examples
- [ ] Add loading state examples to component code
- [ ] Document context hierarchy response structure
- [ ] Add edge cases section

### Documentation Polish:
- [ ] Add migration rollback SQL
- [ ] Add performance baselines
- [ ] Add component communication diagram
- [ ] Add `default` field to `TierContent` interface or remove from SQL
