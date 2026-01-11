# PRD Evaluation: Prediction Dashboard UI Refactor

**Date:** January 9, 2026  
**Evaluator:** AI Code Review  
**PRD:** `2026-01-09-prediction-dashboard-ui-refactor.md`

---

## Executive Summary

The PRD is **well-structured and comprehensive**, covering a major refactor of the prediction dashboard UI. Overall quality is **high**, but there are several **consistency gaps**, **missing technical details**, and **unclear relationships** that should be addressed before implementation begins.

**Overall Assessment:** ✅ **85% Complete** - Ready for refinement, not ready for implementation

---

## 1. Completeness Issues

### 1.1 Missing Agent-Domain Relationship Clarification

**Issue:** The PRD mentions "agent's configured domain" (Section 4.1) but doesn't clarify:
- Can one agent handle multiple domains?
- Is domain determined by agent configuration or by the active universe?
- How does domain selection work when an agent has multiple universes across domains?

**Location:** Section 4.1, Section 4.2

**Recommendation:** Add a subsection explaining:
- Agent-to-domain relationship (1:many? many:many?)
- How domain is determined when viewing the dashboard
- What happens when switching between universes with different domains

### 1.2 Missing REST-to-A2A Migration Details

**Issue:** Section 8 mentions migrating from REST to A2A but doesn't specify:
- Which existing REST endpoints need to be replaced
- Migration timeline/strategy (big bang vs gradual)
- How to handle existing code that calls REST endpoints
- Backward compatibility requirements

**Location:** Section 8, Section 2.3

**Recommendation:** Add a migration section listing:
- Current REST endpoints to deprecate
- A2A method equivalents
- Migration checklist for frontend components
- Deprecation timeline

### 1.3 Missing Error Handling Specifications

**Issue:** The PRD doesn't specify:
- Error handling patterns for A2A calls
- What happens when context creation fails
- How to handle validation errors in the UI
- Network failure recovery strategies

**Location:** Throughout, especially Section 8, Section 13

**Recommendation:** Add error handling section covering:
- A2A error response format
- User-facing error messages
- Retry logic
- Validation error display patterns

### 1.4 Missing Performance Requirements

**Issue:** Section 14 has success metrics but lacks:
- Maximum acceptable load times for context hierarchy
- Pagination strategy for large context lists
- Caching requirements
- Optimistic update patterns

**Location:** Section 14

**Recommendation:** Add performance requirements:
- Context hierarchy load: <500ms
- Context list pagination (e.g., 50 per page)
- Caching strategy for frequently accessed contexts
- Optimistic updates for CRUD operations

### 1.5 Missing Testing Strategy

**Issue:** No mention of:
- Unit test requirements
- Integration test strategy
- E2E test coverage expectations
- Test data setup requirements

**Location:** Missing entirely

**Recommendation:** Add testing section:
- Component unit tests (Vue components)
- A2A integration tests
- E2E tests for critical flows (create context, approve learning)
- Test data fixtures

---

## 2. Consistency Issues

### 2.1 A2A Method Naming Inconsistency

**Issue:** Section 8.1 shows methods like `dashboard.contexts.list`, but Section 8.2 shows handler methods like `@A2AMethod('dashboard.contexts.list')`. The existing codebase (from `prediction-dashboard.router.ts`) uses a different pattern:
- Existing: `dashboard.universes.list` → routes to `UniverseHandler.execute('list', ...)`
- PRD: `dashboard.contexts.list` → routes to `DashboardContextHandler.listContexts()`

**Location:** Section 8.1, Section 8.2

**Recommendation:** 
- Verify the handler pattern matches existing `PredictionDashboardRouter` architecture
- Update Section 8.2 to show handler integration with existing router
- Ensure method names follow existing conventions

### 2.2 Context Type Enum Inconsistency

**Issue:** Context types are listed in multiple places with slight variations:
- Section 3.2: `signal, predictor, prediction, evaluation, learning, analyst`
- Section 9.1: Same list in CHECK constraint
- Section 9.4: Same list in learning_queue CHECK constraint
- But Section 5.3 shows `contextTypes` array with `'all'` option

**Location:** Section 3.2, Section 5.3, Section 9.1, Section 9.4

**Recommendation:** 
- Create a single source of truth (TypeScript enum or constant)
- Reference it consistently throughout PRD
- Clarify that `'all'` is a UI filter, not a database value

### 2.3 Scope Level Terminology

**Issue:** Sometimes called `scope_level`, sometimes `scopeLevel` (camelCase):
- Database schema uses `scope_level` (snake_case)
- TypeScript interfaces likely use `scopeLevel` (camelCase)
- PRD mixes both

**Location:** Throughout, especially Section 9.1, Section 8.1

**Recommendation:** 
- Document the mapping: database = snake_case, TypeScript = camelCase
- Be explicit about transformation layer
- Use consistent terminology in PRD (prefer database terms in schema sections, TypeScript terms in code sections)

### 2.4 Tier Content Structure

**Issue:** Section 3.4 mentions tier content structure, but Section 9.1 shows:
```json
{
  "gold": "...",
  "silver": "...",
  "bronze": "...",
  "default": "Fallback if tier not specified..."
}
```

But Section 3.4 doesn't mention a `default` field, and Section 9.2's `get_effective_contexts` function shows fallback logic that doesn't use `default`.

**Location:** Section 3.4, Section 9.1, Section 9.2

**Recommendation:** 
- Clarify if `default` is required or optional
- Document the fallback chain explicitly: `tier` → `default` → `silver` → empty string?
- Update Section 3.4 to include `default` in the structure

---

## 3. Technical Accuracy Issues

### 3.1 Migration Script Field Mapping

**Issue:** Section 9.3 migration script references fields that may not exist:
- `tier_instructions` - ✅ Exists (confirmed in schema)
- `perspective` - ✅ Exists
- `default_weight` - ✅ Exists
- `learned_patterns` - ✅ Exists
- `agent_id` - ✅ Exists
- `is_enabled` - ✅ Exists (but PRD uses `is_active` in new table)

**Location:** Section 9.3

**Recommendation:** 
- Verify all field names match exactly
- Note that `is_enabled` → `is_active` mapping
- Add validation query to check field existence before migration

### 3.2 Unique Constraint Logic

**Issue:** Section 9.1 shows:
```sql
UNIQUE (slug, context_type, scope_level, domain, universe_id, target_id)
```

This allows the same slug at different scope levels, which seems correct. But the constraint includes `NULL` values, which PostgreSQL handles specially.

**Location:** Section 9.1

**Recommendation:** 
- Clarify: Can the same slug exist at runner and domain level? (Probably yes)
- Document NULL handling in unique constraint
- Consider partial unique indexes for better performance

### 3.3 Analyst Config Structure

**Issue:** Section 9.1 shows `analyst_config` as:
```json
{
  "perspective": "...",
  "default_weight": 1.0
}
```

But Section 9.3 migration includes:
```json
{
  "perspective": "...",
  "default_weight": 1.0,
  "learned_patterns": [...],
  "agent_id": "..."
}
```

**Location:** Section 9.1, Section 9.3

**Recommendation:** 
- Decide: Should `learned_patterns` and `agent_id` be in `analyst_config` or separate columns?
- If separate, update migration script
- If included, update schema definition

### 3.4 Effective Contexts Function Return Type

**Issue:** Section 9.2 function returns `source_scope_name` but doesn't clarify:
- What value for runner level? ("Global"? "Runner"?)
- What if domain is NULL? (Shouldn't happen per constraints, but defensive)

**Location:** Section 9.2

**Recommendation:** 
- Document return value examples for each scope level
- Add defensive NULL handling
- Consider returning scope identifiers (domain, universe_id, target_id) separately for UI flexibility

---

## 4. Design & UX Gaps

### 4.1 Context Inheritance Visualization

**Issue:** Section 5.7 shows `InheritanceView` but doesn't specify:
- How to handle conflicts (same context type at multiple levels)
- Order of precedence display
- How to show "overridden" contexts

**Location:** Section 5.7

**Recommendation:** 
- Add conflict resolution rules
- Show visual indicators for overridden contexts
- Add "view effective" vs "view all" toggle

### 4.2 Context Duplication UX

**Issue:** Section 5.4 mentions "Copy to current scope" but doesn't explain:
- What happens to the original?
- Can you copy from target to universe? (Should you be able to?)
- What about copying analyst config?

**Location:** Section 5.4, Section 5.5

**Recommendation:** 
- Clarify copy vs move semantics
- Document allowed copy paths (e.g., can copy target → universe, but not universe → target?)
- Add confirmation dialog for destructive operations

### 4.3 HITL Review Workflow

**Issue:** Section 6 shows approve/reject flow but doesn't cover:
- Bulk operations (approve 10 items at once?)
- Undo/redo for mistaken approvals
- Review history/audit trail

**Location:** Section 6

**Recommendation:** 
- Add bulk operations section
- Document undo capability (if any)
- Add audit trail requirements

### 4.4 Empty States

**Issue:** No mention of:
- What to show when no contexts exist
- Empty review queue messaging
- Empty universe/target states

**Location:** Throughout UI sections

**Recommendation:** 
- Add empty state designs for all major views
- Include helpful onboarding messages
- Add "getting started" CTAs

---

## 5. API & Integration Gaps

### 5.1 A2A Service Implementation Details

**Issue:** Section 8.1 shows service structure but doesn't specify:
- Error handling (try/catch patterns)
- Request/response types (should use transport-types)
- Retry logic
- Loading states

**Location:** Section 8.1

**Recommendation:** 
- Reference transport-types package
- Show error handling pattern
- Add loading state management
- Document retry strategy

### 5.2 Handler Integration Pattern

**Issue:** Section 8.2 shows `@A2AMethod` decorator but existing codebase uses `PredictionDashboardRouter` with handler classes. The pattern doesn't match.

**Location:** Section 8.2

**Recommendation:** 
- Align with existing `PredictionDashboardRouter` pattern
- Show how `DashboardContextHandler` integrates with router
- Follow existing handler interface (`DashboardHandler`)

### 5.3 Missing API Response Types

**Issue:** No TypeScript interfaces defined for:
- `ContextHierarchy`
- `EffectiveContext`
- `LearningQueueItem`
- Request/response DTOs

**Location:** Section 8, Section 13

**Recommendation:** 
- Add TypeScript interface definitions
- Reference transport-types where applicable
- Show request/response examples

---

## 6. Database Schema Issues

### 6.1 Missing Indexes

**Issue:** Section 9.1 has good indexes but missing:
- Composite index for common queries: `(context_type, scope_level, domain)` 
- Index for active contexts by type: `(is_active, context_type)`

**Location:** Section 9.1

**Recommendation:** 
- Add composite indexes for common query patterns
- Consider partial indexes for filtered queries

### 6.2 Missing RLS Policies

**Issue:** No mention of Row Level Security (RLS) policies, but the system is multi-tenant.

**Location:** Section 9

**Recommendation:** 
- Add RLS policy section
- Document user isolation requirements
- Show policy examples

### 6.3 Missing Audit Fields

**Issue:** Schema has `created_at` and `updated_at` but no:
- `created_by` (user who created)
- `updated_by` (user who last updated)
- Soft delete support?

**Location:** Section 9.1

**Recommendation:** 
- Add `created_by` and `updated_by` fields
- Consider soft delete (`deleted_at`) vs hard delete
- Document audit requirements

---

## 7. Component Architecture Issues

### 7.1 Component Dependencies

**Issue:** Section 10.1 shows component tree but doesn't specify:
- Which components depend on which services
- Shared state management (Pinia stores?)
- Component communication patterns

**Location:** Section 10.1

**Recommendation:** 
- Add dependency diagram
- Specify Pinia store structure
- Document component communication (props, events, stores)

### 7.2 Missing Shared Components

**Issue:** Section 10.1 lists shared components but missing:
- Loading spinner
- Error boundary
- Toast notifications
- Confirmation dialogs

**Location:** Section 10.1

**Recommendation:** 
- Add common UI components list
- Reference existing component library
- Document reuse patterns

---

## 8. Implementation Phases Issues

### 8.1 Phase Dependencies

**Issue:** Section 11 phases don't clearly show dependencies:
- Can Phase 2 (Domain Awareness) start before Phase 0 (Database) completes?
- Does Phase 3 (Context Navigator) depend on Phase 2?

**Location:** Section 11

**Recommendation:** 
- Add dependency graph
- Clarify parallel work opportunities
- Add phase gates (what must be done before next phase)

### 8.2 Missing Rollback Plan

**Issue:** No mention of:
- How to rollback database migrations
- How to revert UI changes if issues found
- Data migration rollback strategy

**Location:** Section 11, Section 9.3

**Recommendation:** 
- Add rollback procedures for each phase
- Document migration rollback SQL
- Add feature flag strategy for gradual rollout

---

## 9. Documentation Gaps

### 9.1 Missing Glossary

**Issue:** Terms like "context", "scope level", "tier" are used throughout but not consistently defined in one place.

**Location:** Throughout

**Recommendation:** 
- Add comprehensive glossary section
- Cross-reference terms
- Include visual diagrams

### 9.2 Missing User Stories

**Issue:** No user stories or use cases to validate requirements.

**Location:** Missing

**Recommendation:** 
- Add user stories for key flows:
  - "As a user, I want to create a context for AAPL so that..."
  - "As a user, I want to review AI suggestions so that..."

### 9.3 Missing Edge Cases

**Issue:** Doesn't cover:
- What if a universe has no targets?
- What if all contexts are inactive?
- What if tier content is empty for all tiers?

**Location:** Throughout

**Recommendation:** 
- Add edge cases section
- Document handling for each case
- Add validation rules

---

## 10. Critical Issues (Must Fix Before Implementation)

### 10.1 ❌ CRITICAL: Handler Pattern Mismatch

**Issue:** Section 8.2 shows `@A2AMethod` decorator pattern, but existing codebase uses `PredictionDashboardRouter` with handler classes that implement `execute(operation, payload, context)`.

**Impact:** Implementation will fail to integrate with existing router.

**Fix Required:** 
- Update Section 8.2 to show handler class implementing existing interface
- Show integration with `PredictionDashboardRouter`
- Follow existing handler pattern from `UniverseHandler`, `TargetHandler`, etc.

### 10.2 ❌ CRITICAL: Missing Transport Types Usage

**Issue:** Section 8.1 service doesn't reference `@orchestrator-ai/transport-types` package, which is required per architecture rules.

**Impact:** Will violate architecture standards and cause type mismatches.

**Fix Required:** 
- Update service to import from transport-types
- Use `ExecutionContext` from transport-types
- Follow A2A protocol structure from transport-types

### 10.3 ❌ CRITICAL: Analyst Config Structure Mismatch

**Issue:** Migration script includes `learned_patterns` and `agent_id` in `analyst_config`, but schema definition doesn't.

**Impact:** Migration will fail or data will be lost.

**Fix Required:** 
- Decide: Include in JSONB or separate columns?
- Update schema OR update migration script
- Ensure consistency

---

## 11. Recommendations Summary

### High Priority (Fix Before Coding)
1. ✅ Fix handler pattern to match existing router architecture
2. ✅ Add transport-types imports and usage
3. ✅ Resolve analyst_config structure inconsistency
4. ✅ Add agent-domain relationship clarification
5. ✅ Add error handling specifications

### Medium Priority (Fix During Planning)
6. Add missing TypeScript interfaces
7. Add RLS policies section
8. Add component dependency diagram
9. Add edge cases documentation
10. Add testing strategy

### Low Priority (Nice to Have)
11. Add user stories
12. Add empty state designs
13. Add performance optimization details
14. Add glossary
15. Add rollback procedures

---

## 12. Positive Aspects

✅ **Well-structured** - Clear sections and organization  
✅ **Comprehensive** - Covers all major areas  
✅ **Visual** - Good use of diagrams and examples  
✅ **Detailed** - Component specs are thorough  
✅ **Consistent naming** - Most terms used consistently  
✅ **Good examples** - Code examples help understanding  

---

## Conclusion

The PRD is **solid and well-thought-out** but needs refinement in several areas before implementation can begin. The critical issues (#10.1-10.3) must be addressed immediately, as they will cause implementation failures.

**Recommended Next Steps:**
1. Address all Critical Issues (Section 10)
2. Add missing technical details (Sections 1-3)
3. Resolve consistency issues (Section 2)
4. Add missing documentation (Section 9)
5. Review with team and iterate

**Estimated Refinement Time:** 2-3 days  
**Ready for Implementation:** After critical issues resolved
