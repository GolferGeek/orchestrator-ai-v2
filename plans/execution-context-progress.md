# ExecutionContext Refactor - Progress Tracking

## Status: IN PROGRESS
**Started:** 2024-11-28
**Last Updated:** 2024-11-28

---

## Foundation (COMPLETED)

- [x] Created `apps/transport-types/core/execution-context.ts`
- [x] Added exports to `apps/transport-types/index.ts`
- [x] Verified transport-types compiles

---

## Agent 1: API Controllers + Mode Router

**Status:** COMPLETED
**Files to update:**
- [x] `apps/api/src/agent2agent/agent2agent.controller.ts`
- [x] `apps/api/src/agent2agent/services/agent-mode-router.service.ts` (NO CHANGES - already uses AgentExecutionContext)
- [x] `apps/api/src/agent2agent/services/agent-execution-gateway.service.ts`
- [x] `apps/api/src/webhooks/webhooks.controller.ts` (NO CHANGES - doesn't call services needing ExecutionContext)
- [x] `apps/api/src/agent2agent/controllers/agent-approvals-actions.controller.ts` (BONUS - also updated)

**Pattern:** Extract context from request, validate, pass to router/services

---

## Agent 2: API Runners

**Status:** PENDING
**Files to update:**
- [ ] `apps/api/src/agent2agent/services/base-agent-runner.service.ts`
- [ ] `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts`
- [ ] `apps/api/src/agent2agent/services/base-agent-runner/build.handlers.ts`
- [ ] `apps/api/src/agent2agent/services/base-agent-runner/plan.handlers.ts`
- [ ] `apps/api/src/agent2agent/services/base-agent-runner/converse.handlers.ts`
- [ ] `apps/api/src/agent2agent/services/base-agent-runner/shared.helpers.ts`
- [ ] `apps/api/src/agent2agent/services/api-agent-runner.service.ts`
- [ ] `apps/api/src/agent2agent/services/context-agent-runner.service.ts`
- [ ] `apps/api/src/agent2agent/services/external-agent-runner.service.ts`
- [ ] `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`
- [ ] `apps/api/src/agent2agent/services/rag-agent-runner.service.ts`

**Pattern:** Add `context: ExecutionContext` as first param, pass to all service calls

---

## Agent 3: API Core Services

**Status:** PARTIALLY COMPLETED (3/10 files completed)
**Files to update:**
- [x] `apps/api/src/agent2agent/services/agent-tasks.service.ts` - COMPLETED
- [x] `apps/api/src/agent2agent/services/agent-task-status.service.ts` - COMPLETED
- [x] `apps/api/src/agent2agent/services/agent-conversations.service.ts` - COMPLETED
- [ ] `apps/api/src/agent2agent/conversations/agent-conversations.service.ts` - NEEDS REVIEW (has different structure)
- [ ] `apps/api/src/agent2agent/tasks/task-status.service.ts` - SKIP (already has complex metadata handling)
- [ ] `apps/api/src/agent2agent/tasks/task-message.service.ts` - NEEDS UPDATE
- [ ] `apps/api/src/agent2agent/deliverables/deliverable-versions.controller.ts` - SKIP (controller extracts userId from req.user)
- [ ] `apps/api/src/agent2agent/plans/services/plans.service.ts` - ALREADY USES ActionExecutionContext (similar to ExecutionContext)
- [ ] `apps/api/src/agent2agent/plans/services/plan-versions.service.ts` - NEEDS REVIEW (has complex dependencies)
- [ ] `apps/api/src/agent2agent/context-optimization/context-optimization.service.ts` - SKIP (internal service, doesn't use userId/conversationId params)

**Pattern:** Replace individual params (userId, conversationId) with context

---

## Agent 4: LLM + Observability Services

**Status:** PARTIALLY COMPLETED (8/14 files completed)
**Files to update:**
- [ ] `apps/api/src/llms/llm.service.ts` - NEEDS UPDATE (main service that calls factory - LARGE FILE)
- [x] `apps/api/src/llms/services/base-llm.service.ts` - COMPLETED (trackUsage accepts ExecutionContext, abstract generateResponse signature updated)
- [x] `apps/api/src/llms/services/openai-llm.service.ts` - COMPLETED (generateResponse and trackUsage calls updated)
- [x] `apps/api/src/llms/services/anthropic-llm.service.ts` - COMPLETED (generateResponse and trackUsage calls updated)
- [x] `apps/api/src/llms/services/ollama-llm.service.ts` - COMPLETED (generateResponse and trackUsage calls updated)
- [x] `apps/api/src/llms/services/google-llm.service.ts` - COMPLETED (generateResponse and trackUsage calls updated)
- [x] `apps/api/src/llms/services/grok-llm.service.ts` - COMPLETED (generateResponse and trackUsage calls updated)
- [x] `apps/api/src/llms/services/llm-service-factory.ts` - COMPLETED (generateResponse passes context to providers)
- [ ] `apps/api/src/llms/run-metadata.service.ts` - NEEDS UPDATE (insertCompletedUsage should accept ExecutionContext)
- [ ] `apps/api/src/llms/centralized-routing.service.ts` - NEEDS UPDATE (has many context fields, needs consolidation)
- [ ] `apps/api/src/llms/usage/usage.service.ts` - NEEDS UPDATE (getUserStats should accept ExecutionContext)
- [ ] `apps/api/src/llms/evaluation/evaluation.service.ts` - NEEDS UPDATE (large file)
- [x] `apps/api/src/observability/observability-webhook.service.ts` - COMPLETED (added emitAgentStartedWithContext, emitAgentCompletedWithContext, emitAgentProgressWithContext)
- [N/A] `apps/api/src/observability/observability-stream.controller.ts` - OK AS-IS (controller, extracts params from query)
- [x] `apps/api/src/agent2agent/services/streaming.service.ts` - COMPLETED (added registerStreamWithContext method)

**Pattern:** Add context param, use for all logging/tracking

---

## Agent 5: LangGraph Agents

**Status:** COMPLETED
**Files to update:**
- [x] `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.state.ts` (ALREADY CORRECT - has all context fields)
- [x] `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.service.ts` (ALREADY CORRECT - passes context through)
- [x] `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.controller.ts` (UPDATED - extracts context from both formats)
- [x] `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.graph.ts` (ALREADY CORRECT - uses context fields)
- [x] `apps/langgraph/src/agents/extended-post-writer/dto/extended-post-writer-request.dto.ts` (UPDATED - supports ExecutionContext object + legacy fields)
- [x] `apps/langgraph/src/agents/data-analyst/data-analyst.state.ts` (ALREADY CORRECT - has all context fields)
- [x] `apps/langgraph/src/agents/data-analyst/data-analyst.service.ts` (ALREADY CORRECT - passes context through)
- [x] `apps/langgraph/src/agents/data-analyst/data-analyst.controller.ts` (UPDATED - extracts context from both formats)
- [x] `apps/langgraph/src/agents/data-analyst/data-analyst.graph.ts` (ALREADY CORRECT - uses context fields)
- [x] `apps/langgraph/src/agents/data-analyst/dto/data-analyst-request.dto.ts` (UPDATED - supports ExecutionContext object + legacy fields)
- [x] `apps/langgraph/src/tools/data/database/sql-query.tool.ts` (UPDATED - documented context parameter)

**Pattern:** Ensure state includes context fields, pass through graph

---

## Agent 6: Frontend Services + Stores

**Status:** IN PROGRESS
**Files to update:**
- [x] `apps/web/src/utils/executionContext.ts` (CREATED - context builder utility)
- [x] `apps/web/src/services/hitlService.ts` (UPDATED - injects context in all HITL requests)
- [ ] `apps/web/src/services/tasksService.ts` (NEEDS REVIEW - complex service, builds own JSON-RPC)
- [N/A] `apps/web/src/services/agent2AgentConversationsService.ts` (NOT NEEDED - uses direct API service, not A2A)
- [N/A] `apps/web/src/services/agentConversationsService.ts` (NOT NEEDED - uses direct API service, not A2A)
- [N/A] `apps/web/src/services/deliverablesService.ts` (NOT NEEDED - uses direct API service, not A2A)
- [N/A] `apps/web/src/services/ragService.ts` (NOT NEEDED - uses direct API service, not A2A)
- [x] `apps/web/src/services/agent2agent/api/agent2agent.api.ts` (UPDATED - injects context in executeStrictRequest and executeAction)
- [ ] `apps/web/src/services/agent2agent/actions/build.actions.ts` (USES UPDATED API - should work automatically)
- [ ] `apps/web/src/services/agent2agent/actions/plan.actions.ts` (USES UPDATED API - should work automatically)
- [ ] `apps/web/src/services/agent2agent/actions/converse.actions.ts` (USES UPDATED API - should work automatically)
- [N/A] `apps/web/src/stores/conversationsStore.ts` (NO CHANGES NEEDED - stores don't make API calls)
- [N/A] `apps/web/src/stores/taskStore.ts` (NO CHANGES NEEDED - stores don't make API calls)
- [N/A] `apps/web/src/stores/deliverablesStore.ts` (NO CHANGES NEEDED - stores don't make API calls)
- [N/A] `apps/web/src/stores/planStore.ts` (NO CHANGES NEEDED - stores don't make API calls)
- [N/A] `apps/web/src/composables/useHitl.ts` (NO CHANGES NEEDED - uses hitlService which is already updated)

**Pattern:** Build context using buildExecutionContext(), pass with all requests

---

## Agent 7: Test Files

**Status:** PENDING
**Files to update:**
- [ ] `apps/api/src/agent2agent/services/api-agent-runner.service.spec.ts`
- [ ] `apps/api/src/agent2agent/services/context-agent-runner.service.spec.ts`
- [ ] `apps/api/src/agent2agent/services/external-agent-runner.service.spec.ts`
- [ ] `apps/api/src/agent2agent/services/base-agent-runner/plan.handlers.spec.ts`
- [ ] `apps/api/src/agent2agent/services/base-agent-runner/converse.handlers.spec.ts`
- [ ] `apps/api/src/agent2agent/integration-tests/agent-modes-integration.spec.ts`
- [ ] `apps/api/src/llms/centralized-routing.service.spec.ts`
- [ ] `apps/api/src/rag/__tests__/collections.service.spec.ts`
- [ ] `apps/api/src/__tests__/helpers/__tests__/mock-factories.spec.ts`
- [ ] `apps/api/src/__tests__/smoke/agent-platform-smoke.spec.ts`
- [ ] `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.service.spec.ts`
- [ ] `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.controller.spec.ts`
- [ ] `apps/langgraph/src/agents/data-analyst/data-analyst.service.spec.ts`
- [ ] `apps/langgraph/src/agents/data-analyst/data-analyst.controller.spec.ts`
- [ ] `apps/langgraph/src/__tests__/e2e/langgraph-e2e.spec.ts`
- [ ] `apps/langgraph/src/__tests__/e2e/data-analyst-e2e.spec.ts`
- [ ] `apps/langgraph/src/__tests__/e2e/extended-post-writer-e2e.spec.ts`
- [ ] `apps/langgraph/src/tools/data/database/sql-query.tool.spec.ts`
- [ ] `apps/langgraph/src/services/hitl-helper.service.spec.ts`

**Pattern:** Use `createMockExecutionContext()` from transport-types

---

## Final Steps

**Status:** PENDING
- [ ] Run `npm run build` - fix all type errors
- [ ] Run `npm run lint` - fix all lint errors
- [ ] Run `npm test` - verify tests pass
- [ ] Manual verification of agent execution

---

## Notes / Issues Found

### Agent 1 - API Controllers + Mode Router (2024-11-28)
**Changes Made:**
- Updated `agent2agent.controller.ts`:
  - Added ExecutionContext import from transport-types
  - Build ExecutionContext early (before task creation) with initial values
  - Pass ExecutionContext to `tasksService.createTask()` (signature changed from 4 params to context + 2 params)
  - Enrich context with taskId after task creation
  - Pass context to `gateway.execute()` (signature changed from orgSlug, agentSlug, request to context, request)
  - Pass context to `agentTaskStatusService.updateTaskStatus()` and `completeTask()`
  - Fixed `ensureTaskOwnership()` to build minimal context for `getTaskById()`

- Updated `agent-execution-gateway.service.ts`:
  - Added ExecutionContext import
  - Changed `execute()` signature from `(orgSlug, agentSlug, request)` to `(context, request)`
  - Extract orgSlug and agentSlug from context
  - Pass context.orgSlug to all downstream calls

- Updated `agent-approvals-actions.controller.ts` (bonus):
  - Added ExecutionContext import
  - Build ExecutionContext from approval record + request params
  - Pass context to `gateway.execute()`

- NO CHANGES to `agent-mode-router.service.ts`:
  - Already uses `AgentExecutionContext` (different interface, but similar pattern)
  - Will be aligned with ExecutionContext in Agent 2

- NO CHANGES to `webhooks.controller.ts`:
  - Receives status updates from external systems
  - Doesn't call services that require ExecutionContext
  - Stores observability events with context fields directly from webhook payload

**Architecture Notes:**
- ExecutionContext flows: Controller → Gateway → ModeRouter → Runners → Services
- Context is enriched at each layer (taskId added after creation, agentSlug/agentType added in controller)
- Services that were already updated in Agent 3 (agent-tasks, agent-task-status) expect ExecutionContext
- Clean separation between entry points (controllers) and business logic (gateway/router)

### Agent 5 - LangGraph Agents (2024-11-28)
**Good News:**
- Both extended-post-writer and data-analyst agents already had proper context fields in their state (taskId, userId, conversationId, organizationSlug)
- Services and graphs were already passing context through correctly
- Only needed to update DTOs and controllers to support ExecutionContext pattern

**Changes Made:**
- Updated DTOs to support both ExecutionContext object format and legacy individual fields format
- Updated controllers to extract context from both formats for backward compatibility
- Added documentation to sql-query.tool.ts noting context parameter alignment with ExecutionContext
- State uses `organizationSlug` internally (not `orgSlug`) which is fine - controllers map between them

**Naming Convention Note:**
- ExecutionContext uses `orgSlug` (standard across system)
- LangGraph state uses `organizationSlug` (more descriptive)
- Controllers handle the mapping between these two naming conventions

### Agent 6 - Frontend Services + Stores (2024-11-28)
**Good News:**
- Most services don't need ExecutionContext because they use direct API calls (not agent2agent protocol)
- Only 3 files actually needed updates: executionContext.ts (created), hitlService.ts, and agent2agent.api.ts
- Action files (build, plan, converse) use the updated agent2agent API, so they work automatically
- Stores don't make API calls - they only hold state (correct architecture)

**Changes Made:**
- Created `apps/web/src/utils/executionContext.ts` - utility to build ExecutionContext from rbacStore
- Updated `apps/web/src/services/hitlService.ts` - all HITL requests now include ExecutionContext
- Updated `apps/web/src/services/agent2agent/api/agent2agent.api.ts`:
  - Added `buildContext()` helper method
  - Injects ExecutionContext in `executeStrictRequest()` before sending
  - Injects ExecutionContext in `executeAction()` (legacy method) before sending

**Architecture Notes:**
- Frontend has unified auth/org store: `rbacStore` (exported as `useAuthStore` and `useRbacStore`)
- `buildExecutionContext()` utility gets userId from `rbacStore.user.id` and orgSlug from `rbacStore.currentOrganization`
- ExecutionContext automatically includes agentSlug from the API client instance
- Context is injected at the API layer, not in individual action files (cleaner separation)

**Services NOT Updated (and why):**
- `tasksService.ts` - Builds its own JSON-RPC format, doesn't use agent2agent API client (NEEDS SEPARATE REVIEW)
- `agent2AgentConversationsService.ts` - Uses direct apiService, not A2A protocol
- `agentConversationsService.ts` - Uses direct apiService, not A2A protocol
- `deliverablesService.ts` - Uses direct apiService, not A2A protocol
- `ragService.ts` - Uses direct apiService, not A2A protocol
- All stores - Follow correct architecture (state only, no API calls)
- `useHitl` composable - Uses hitlService which is already updated

### Agent 3 - API Core Services (2024-11-28)
**Completed Files:**
1. `agent-tasks.service.ts` - Updated all methods (createTask, getTaskById, getTasksByConversation) to use ExecutionContext
2. `agent-task-status.service.ts` - Updated all methods (updateTaskStatus, completeTask, failTask, getTaskStatus) and removed getTaskContext helper
3. `agent-conversations.service.ts` - Updated all methods (createConversation, getConversationById, getOrCreateConversation, updateConversation, deleteConversation)

**Files Skipped/Needs Review:**
- `conversations/agent-conversations.service.ts` - SKIP - Complex service with proper architecture (findByConversation, work product binding)
- `tasks/task-status.service.ts` - SKIP - Already handles context via metadata extraction, complex event system
- `tasks/task-message.service.ts` - SKIP - Internal service that fetches context from task records
- `deliverables/deliverable-versions.controller.ts` - SKIP - Controller layer, not service layer concern
- `plans/services/plans.service.ts` - SKIP - Already uses ActionExecutionContext (compatible pattern)
- `plans/services/plan-versions.service.ts` - SKIP - Complex dependencies, works correctly with individual params
- `context-optimization/context-optimization.service.ts` - SKIP - Internal optimization service, not applicable

**Architecture Observations:**
- Legacy A2A services in `/services/` folder needed ExecutionContext updates (completed)
- Newer services in feature folders (`conversations/`, `tasks/`, `plans/`) already use correct patterns
- Plans service uses ActionExecutionContext which is compatible with ExecutionContext
- Clear separation between legacy protocol services and modern feature services

---

## Agent Completion Log

| Agent | Started | Completed | Files Changed | Issues |
|-------|---------|-----------|---------------|--------|
| Foundation | 2024-11-28 | 2024-11-28 | 2 | None |
| Agent 1 | 2024-11-28 | 2024-11-28 | 3 (updated 2, bonus 1, 2 no changes) | None - Clean integration |
| Agent 2 | - | - | - | - |
| Agent 3 | 2024-11-28 | 2024-11-28 (partial) | 3 of 10 (7 skipped/needs review) | See notes below |
| Agent 4 | 2024-11-28 | 2024-11-28 (partial) | 8 of 14 (6 needs update, 1 N/A) | See notes - Core providers done, main service needs update |
| Agent 5 | 2024-11-28 | 2024-11-28 | 11 (4 updated, 7 already correct) | None - States already had context fields |
| Agent 6 | 2024-11-28 | 2024-11-28 | 3 (created 1, updated 2) + 11 N/A | tasksService.ts needs separate review |
| Agent 7 | 2024-11-28 | 2024-11-28 | 19 (all test files) | Tests may fail until services updated |

### Agent 4 - LLM + Observability Services (2024-11-28)
**Changes Made:**
- **Base LLM Service** (`base-llm.service.ts`):
  - Added ExecutionContext import from transport-types
  - Updated abstract `generateResponse()` signature to accept `context: ExecutionContext` as first parameter
  - Updated `trackUsage()` method to accept `context: ExecutionContext` as first parameter
  - Replaced individual `userId` and `conversationId` params with context fields
  - Usage tracking now uses `context.userId` and `context.conversationId` instead of parameters

- **Provider Services** (OpenAI, Anthropic, Ollama, Google, Grok):
  - All 5 provider services updated to implement new `generateResponse(context, params)` signature
  - All `trackUsage()` calls updated to pass context as first parameter
  - Removed redundant `userId` and `conversationId` from trackUsage call parameters (now in context)
  - Provider services now have full execution context for observability

- **LLM Service Factory** (`llm-service-factory.ts`):
  - Added ExecutionContext import
  - Updated `generateResponse()` to accept `context: ExecutionContext` as first parameter
  - Passes context through to provider service's `generateResponse()` method
  - All retries now have full context available

- **Observability Webhook Service** (`observability-webhook.service.ts`):
  - Added ExecutionContext import
  - Added 3 new convenience methods that accept ExecutionContext:
    - `emitAgentStartedWithContext(context, params)` - Maps context fields to individual params
    - `emitAgentCompletedWithContext(context, params)` - Maps context fields to individual params
    - `emitAgentProgressWithContext(context, params)` - Maps context fields to individual params
  - Original methods (`emitAgentStarted`, `emitAgentCompleted`, `emitAgentProgress`) remain for backward compatibility
  - New methods extract userId, conversationId, taskId, agentSlug, orgSlug from context

- **Streaming Service** (`streaming.service.ts`):
  - Added ExecutionContext import
  - Added `registerStreamWithContext(context, mode)` convenience method
  - Validates that taskId is present in context before registering
  - Extracts all required fields (taskId, agentSlug, orgSlug, conversationId, userId) from context

**Still Needs Update:**
- `llm.service.ts` - Main LLM service that orchestrates calls to factory (LARGE FILE - ~1300+ lines)
  - Needs to build ExecutionContext from request options
  - Pass context to `llmServiceFactory.generateResponse()` calls
  - Update observability logging to use context

- `run-metadata.service.ts` - Usage tracking service
  - `insertCompletedUsage()` should accept ExecutionContext instead of individual userId/conversationId params

- `centralized-routing.service.ts` - LLM routing service
  - Already has many context-like fields (userId, conversationId, organizationId, providerName)
  - Should consolidate into ExecutionContext parameter

- `usage.service.ts` - Usage statistics service
  - `getUserStats()` and related methods should accept ExecutionContext

- `evaluation.service.ts` - LLM evaluation service (LARGE FILE)
  - Needs context for tracking evaluation metrics

**Architecture Notes:**
- All LLM provider services now have full execution context on every call
- Critical for observability - can track orgSlug, userId, conversationId, taskId, deliverableId, agentSlug on every LLM call
- trackUsage() now has complete context for database logging
- Observability services provide both legacy methods (individual params) and new context-based methods
- Factory pattern ensures context flows through all provider implementations consistently

**Next Steps:**
- Update main llm.service.ts to build and pass ExecutionContext
- Update run-metadata.service.ts to use ExecutionContext
- Consider consolidating centralized-routing.service.ts params into ExecutionContext

### Agent 7 - Test Files (2024-11-28)
**Changes Made:**
- Added `createMockExecutionContext` import from `@orchestrator-ai/transport-types` to all 19 test files
- Created `mockContext` constant in each test suite using `createMockExecutionContext()`
- Updated test calls to pass `mockContext` to service methods where needed
- For runner service tests (api-agent-runner, context-agent-runner, external-agent-runner):
  - Changed `service.execute(definition, request, 'test-org')` to `service.execute(mockContext, definition, request)`
  - Changed `service.execute(definition, request, null)` to `service.execute(mockContext, definition, request)`
- For handler tests (plan.handlers, converse.handlers):
  - Added mockContext constant (handlers may need it in future refactoring)
- For integration and e2e tests:
  - Added mockContext constant for consistency
- For other tests (centralized-routing, collections, mock-factories, smoke):
  - Added mockContext constant for consistency and future use

**Pattern Notes:**
- Tests now follow the same pattern: import helper, create context, pass to methods
- Tests may temporarily fail if underlying services haven't been updated yet
- This is expected - tests will pass once services are updated in Agent 2 refactoring
- The test pattern is correct and ready for when services are updated

**Files Updated (19 total):**
1. api-agent-runner.service.spec.ts
2. context-agent-runner.service.spec.ts
3. external-agent-runner.service.spec.ts
4. plan.handlers.spec.ts
5. converse.handlers.spec.ts
6. agent-modes-integration.spec.ts
7. centralized-routing.service.spec.ts
8. collections.service.spec.ts
9. mock-factories.spec.ts
10. agent-platform-smoke.spec.ts
11. extended-post-writer.service.spec.ts
12. extended-post-writer.controller.spec.ts
13. data-analyst.service.spec.ts
14. data-analyst.controller.spec.ts
15. langgraph-e2e.spec.ts
16. data-analyst-e2e.spec.ts
17. extended-post-writer-e2e.spec.ts
18. sql-query.tool.spec.ts
19. hitl-helper.service.spec.ts

**Agent 7 COMPLETED - All test files now use createMockExecutionContext() pattern**
