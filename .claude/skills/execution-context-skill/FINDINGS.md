# Execution Context Deep Dive - Findings

**Date:** 2025-01-18  
**Subconversation:** 1 of 11  
**Status:** ✅ Complete

## Summary

Completed deep dive into ExecutionContext system. Created `execution-context-skill` to enforce the "capsule" pattern throughout the codebase.

## Key Findings

### 1. Current Implementation Status

**✅ Well-Defined:**
- ExecutionContext interface is clearly defined in `apps/transport-types/core/execution-context.ts`
- Front-end creates it properly in `executionContextStore.ts`
- Backend receives it and creates conversation/task records when needed
- LangGraph workflows receive it in state annotations

**⚠️ Violations Found:**
- Some services still take individual parameters (`userId`, `conversationId`) instead of ExecutionContext
- Some code destructures context before passing to services
- Some observability calls missing full context
- Some helper functions extract fields instead of passing whole capsule

### 2. The Capsule Pattern

**Core Principle:** ExecutionContext is a complete, immutable "capsule" that must always be passed as a whole, never as individual fields.

**Contents:**
- `orgSlug`, `userId`, `conversationId`, `taskId`
- `planId`, `deliverableId` (use NIL_UUID if none)
- `agentSlug`, `agentType`
- `provider`, `model` (use NIL_UUID for API agents with fixed provider/model)

### 3. Flow Through System

**Front-End:**
1. Created once when conversation is selected
2. `taskId` and `conversationId` generated upfront
3. Immutable (except `setLLM()` for model changes)
4. Passed with every A2A request

**Back-End:**
1. Received from front-end in every request
2. Validated (userId matches auth token)
3. Creates conversation/task records if needed
4. May update `planId`/`deliverableId` and return updated capsule
5. Passes through all services, runners, LLM calls, observability

**LangGraph:**
1. Received in state annotation
2. Passed to LLM and observability services
3. Never constructed in LangGraph, only received

### 4. Common Violations

1. **Individual Parameters**: Functions taking `userId: string, conversationId: string` instead of `context: ExecutionContext`
2. **Destructuring**: Extracting fields before passing to services
3. **Construction**: Building ExecutionContext in backend from pieces
4. **Missing Context**: LLM calls or observability calls without full context
5. **Partial Context**: Passing only some fields (e.g., just `userId` and `taskId`)

### 5. Files Requiring Attention

**High Priority:**
- `apps/api/src/agent2agent/services/agent-tasks.service.ts` - `createTask()` takes individual params
- `apps/api/src/agent2agent/services/base-agent-runner/shared.helpers.ts` - `resolveUserId()` extracts instead of using context
- `apps/api/src/rbac/rbac.service.ts` - Methods take `userId` instead of context

**Medium Priority:**
- `apps/api/src/webhooks/webhooks.controller.ts` - Destructures context before passing
- `apps/api/src/agent2agent/services/base-agent-runner/converse.handlers.ts` - Constructs context from pieces

**Low Priority:**
- Test files (can be updated gradually)
- Legacy code (update during refactoring)

## Skill Created

**Location:** `.claude/skills/execution-context-skill/`

**Files:**
1. `SKILL.md` - Main skill definition with principles, patterns, anti-patterns
2. `VIOLATIONS.md` - Detailed examples of violations and fixes
3. `ENFORCEMENT.md` - Strategy for enforcing the pattern
4. `FINDINGS.md` - This document

## Integration Points

This skill integrates with:
- **Transport Types Skill** (Subconversation 2) - Ensures A2A requests include ExecutionContext
- **Quality Gates Skill** - Checks for violations during PR review
- **Codebase Hardening** (Subconversation 9) - Systematic audit of violations
- **Direct Commit Skill** - Validates ExecutionContext before committing

## Next Steps

1. **Subconversation 2**: Transport Types & A2A Compliance
2. **Subconversation 3**: LangGraph Prescriptive Building Pattern
3. **Subconversation 4**: N8N Prescriptive Building Pattern

## User's Key Requirements Met

✅ **Understanding of ExecutionContext**: Deep dive completed, pattern documented  
✅ **Capsule Pattern**: Documented and enforced  
✅ **Violation Detection**: Common violations identified and documented  
✅ **Fix Guidance**: Detailed examples of how to fix violations  
✅ **Enforcement Strategy**: Multi-level enforcement approach defined  

## Notes

- The refactor plan in `plans/execution-context-refactor.md` is still relevant but incomplete
- Many violations are in helper functions that extract fields - these should be refactored
- Observability is the most critical area - missing context breaks tracking
- LangGraph implementation is already good - receives context properly in state

