# ExecutionContext Compliance Audit - Workstream 1A

**Date:** 2025-12-29
**Auditor:** Codebase Hardening Agent
**Refactoring ID:** execution-context-compliance
**Priority:** CRITICAL

## Executive Summary

Conducted systematic audit of ExecutionContext flow through the API application. Of 7 flagged issues:
- **3 are compliant** (including 1 intentional mutation)
- **1 requires refactoring** (but blocked by missing tests)
- **3 are false positives** (service types don't require ExecutionContext)

**Critical Blocker:** api-014 (ObservabilityWebhookService) needs refactoring but lacks test coverage.

---

## Issue-by-Issue Analysis

### api-001: Agent Runtime Execution Service
**File:** `apps/api/src/agent-platform/services/agent-runtime-execution.service.ts`
**Status:** ✅ **FALSE POSITIVE**

**Finding:**
This service is a utility for metadata operations, not agent execution. It does not handle ExecutionContext.

**Evidence:**
```typescript
@Injectable()
export class AgentRuntimeExecutionService {
  getAgentMetadataFromDefinition(
    definition: AgentRuntimeDefinition,
    organizationSlug: string | null,
  ): AgentRuntimeAgentMetadata { ... }

  collectRequestMetadata(request: { ... }): JsonObject { ... }

  enrichPlanDraft(draft: unknown, agent: AgentRuntimeAgentMetadata): JsonObject { ... }

  buildRunMetadata(base: JsonObject, agent: AgentRuntimeAgentMetadata, extras: RuntimeMetadataExtras): JsonObject { ... }
}
```

**Recommendation:** None - service is correctly scoped to metadata operations.

---

### api-004: Base Agent Runner ExecutionContext Usage
**File:** `apps/api/src/agent2agent/services/base-agent-runner.service.ts`
**Line:** 467
**Status:** ✅ **COMPLIANT** (minor logging cleanup recommended)

**Finding:**
ExecutionContext IS extracted and used correctly. The pattern of extracting to a local variable is acceptable for readability.

**Evidence:**
```typescript
protected async handleBuildWithStreaming(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  _executionMode: string,
): Promise<TaskResponseDto> {
  // Get ExecutionContext from request (required)
  const context = request.context;  // Line 467
  if (!context) {
    throw new Error('ExecutionContext is required for streaming');
  }

  // Pass full context to services
  this.streamingService.registerStream(context, mode, userMessage);
  this.streamingService.emitProgress(context, 'Starting build execution...', userMessage, { ... });
}
```

**Minor Issue:** Console.log statements found (lines 96-106) should use `this.logger.debug()`.

**Test Coverage:** Tests exist at `apps/api/src/agent2agent/services/context-agent-runner.service.spec.ts`

**Recommendation:**
- Clean up console.log statements (non-blocking)
- ExecutionContext usage is correct

---

### api-005: ExecutionContext Mutation in Context Agent Runner
**File:** `apps/api/src/agent2agent/services/context-agent-runner.service.ts`
**Line:** 591
**Status:** ✅ **COMPLIANT** (intentional backend mutation)

**Finding:**
Mutation is INTENTIONAL and CORRECT per execution-context-skill rules. Backend is allowed to mutate `planId` when first created (from NIL_UUID).

**Evidence:**
```typescript
// MUTATION: Set planId when first created (from NIL_UUID)
if (plan?.id && request.context.planId === NIL_UUID) {
  request.context.planId = plan.id;
}
```

**From execution-context-skill:**
> "Backend can ONLY mutate planId when first created (from NIL_UUID)"

**Verification:**
- ✅ Guard condition present: `request.context.planId === NIL_UUID`
- ✅ Comment documents intention
- ✅ Only mutates `planId`, not other fields
- ✅ Follows architectural pattern

**Recommendation:** None - implementation is correct.

---

### api-010: LLM Service ExecutionContext Validation
**File:** `apps/api/src/llms/llm.service.ts`
**Lines:** 148-175
**Status:** ✅ **COMPLIANT**

**Finding:**
All major LLM methods properly handle ExecutionContext.

**Evidence:**

1. **`generateResponse()` (line 143):**
```typescript
async generateResponse(
  systemPrompt: string,
  userMessage: string,
  options?: GenerateResponseOptions,
): Promise<string | LLMResponse> {
  const executionContext = options?.executionContext;

  // ExecutionContext is required - it contains provider, model, and all context
  if (!executionContext) {
    throw new Error(
      'ExecutionContext is required for generateResponse. Pass executionContext in options.',
    );
  }

  // Extract provider/model from ExecutionContext
  const providerName = executionContext.provider;
  const modelName = executionContext.model;

  // Emit LLM started event
  this.emitLlmObservabilityEvent('agent.llm.started', executionContext, { ... });
```

2. **`generateUnifiedResponse()` (line 514):**
```typescript
async generateUnifiedResponse(
  params: UnifiedGenerateResponseParams,
): Promise<string | LLMResponse> {
  const executionContext = params.options?.executionContext;

  // Emit LLM started event - use direct push when ExecutionContext is available
  if (executionContext) {
    this.emitLlmObservabilityEvent('agent.llm.started', executionContext, { ... });
  }
```

3. **`generateImage()` (line 1929):**
```typescript
async generateImage(params: {
  provider: string;
  model: string;
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
  numberOfImages?: number;
  referenceImageUrl?: string;
  background?: 'transparent' | 'opaque' | 'auto';
  executionContext: ExecutionContext;  // Required parameter
```

4. **`generateVideo()` (line 2057):**
- Also requires `executionContext` as parameter

**Test Coverage:** ❌ **NO TESTS FOUND** - Critical gap

**Recommendation:**
- ExecutionContext usage is correct
- Add comprehensive unit tests before any refactoring

---

### api-014: ObservabilityWebhookService ExecutionContext Compliance
**File:** `apps/api/src/observability/observability-webhook.service.ts`
**Status:** ❌ **NON-COMPLIANT** (blocked by missing tests)

**Finding:**
Service methods take individual fields instead of ExecutionContext as first parameter. This violates the ExecutionContext capsule pattern.

**Current Implementation:**
```typescript
async emitAgentStarted(params: {
  userId: string;
  conversationId?: string;
  taskId: string;
  agentSlug: string;
  organizationSlug?: string;
  mode: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await this.sendEvent({
    source_app: 'orchestrator-ai',
    session_id: params.conversationId || params.taskId,
    hook_event_type: 'agent.started',
    userId: params.userId,
    conversationId: params.conversationId,
    taskId: params.taskId,
    agentSlug: params.agentSlug,
    organizationSlug: params.organizationSlug,
    mode: params.mode,
    payload: { ...params.payload },
  });
}
```

**Problem:** Cherry-picking individual fields violates execution-context-skill rules.

**Proposed Refactoring:**
```typescript
async emitAgentStarted(
  context: ExecutionContext,
  mode: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await this.sendEvent({
    source_app: 'orchestrator-ai',
    session_id: context.conversationId || context.taskId,
    hook_event_type: 'agent.started',
    userId: context.userId,
    conversationId: context.conversationId,
    taskId: context.taskId,
    agentSlug: context.agentSlug,
    organizationSlug: context.orgSlug,
    mode: mode,
    payload: { ...payload },
  });
}
```

**Test Coverage:** ❌ **NO TESTS FOUND**

**Required Test Coverage Before Fix:**
- Unit tests for all event emission methods
- Integration tests for SSE streaming
- Tests for username resolution and caching
- Tests for non-blocking error handling

**Implementation Steps (when tests are adequate):**
1. Add comprehensive unit tests for ObservabilityWebhookService
2. Refactor method signatures to accept ExecutionContext as first parameter
3. Update all callers throughout codebase
4. Run tests to verify no breaking changes
5. Update documentation

**Estimated Effort:** 2-3 days (including test creation)

**Priority:** HIGH (blocks execution-context-compliance refactoring)

---

### api-016: RAG Services ExecutionContext Usage
**Files:** `apps/api/src/rag/*.service.ts`
**Status:** ✅ **NOT APPLICABLE** (false positive)

**Finding:**
RAG services are REST API endpoints for data management, not A2A protocol endpoints. ExecutionContext is not required.

**Evidence:**
```typescript
// Example: collections.service.ts
async getCollections(
  organizationSlug: string,
  userId?: string,
): Promise<RagCollection[]> {
  const rows = await this.ragDb.queryAll<DbCollection>(
    'SELECT * FROM rag_get_collections($1, $2)',
    [organizationSlug, userId || null],
  );
  return rows.map((row) => this.toCollection(row));
}

async queryCollection(
  collectionId: string,
  organizationSlug: string,
  dto: QueryCollectionDto,
): Promise<QueryResponse> {
  // Vector similarity search - data operation, not agent execution
}
```

**From transport-types-skill:**
> "❌ DON'T Use Transport Types for non-A2A endpoints (e.g., `/api/conversations`, `/api/users` - regular REST endpoints)"

**Analysis:**
- RAG services handle CRUD operations for collections, documents, and queries
- These are regular REST endpoints (`/api/rag/...`), not A2A protocol
- They correctly take `organizationSlug` and `userId` as separate parameters
- No agent execution or A2A protocol involved

**Recommendation:** None - RAG services are correctly implemented for REST API pattern.

---

### api-018: MCP Services ExecutionContext Usage
**Files:** `apps/api/src/mcp/*.service.ts`
**Status:** ✅ **NOT APPLICABLE** (false positive)

**Finding:**
MCP (Model Context Protocol) services are tool providers, not A2A agent runners. ExecutionContext is not required.

**Evidence:**
```typescript
// Example: mcp.service.ts
async listTools(): Promise<{ tools: MCPToolDefinition[] }> {
  const tools = await this.supabaseMCP.listTools();
  return { tools };
}

async callTool(request: MCPToolRequest): Promise<MCPToolResponse> {
  return await this.supabaseMCP.callTool(request);
}
```

**Analysis:**
- MCP services expose tools via MCP protocol (JSON-RPC, but not A2A)
- They provide database access tools (Supabase, Notion, Slack)
- These are support services consumed by agents, not agent execution paths
- No ExecutionContext needed for MCP tool execution

**Recommendation:** None - MCP services are correctly scoped.

---

## Test Coverage Analysis

### Services WITH Tests:
- ✅ `context-agent-runner.service.ts` - Has spec file
- ✅ `api-agent-runner.service.ts` - Has spec file
- ✅ RAG services - Have test files in `__tests__/` directory
- ✅ Several agent-platform services - Have spec files

### Services WITHOUT Tests (Critical Gap):
- ❌ `observability-webhook.service.ts` - **NO TESTS**
- ❌ `llm.service.ts` - **NO TESTS**
- ❌ `agent-runtime-execution.service.ts` - **NO TESTS**
- ❌ MCP services - **NO TESTS**

**Impact:** Cannot safely auto-fix api-014 without test coverage.

---

## Recommendations

### Immediate Actions:
1. **Document api-014 for manual fix** (this document)
2. **Close false positives** (api-001, api-016, api-018)
3. **Add logging cleanup task** for api-004 (non-blocking)

### Medium-Term (1-2 weeks):
1. **Add unit tests for ObservabilityWebhookService**
   - Coverage target: ≥75% lines, ≥70% branches
   - Include SSE streaming tests
   - Include username resolution tests
   - Include error handling tests

2. **Add unit tests for LLMService**
   - Coverage target: ≥75% lines, ≥70% branches
   - Include all generation methods
   - Include PII processing tests
   - Include provider routing tests

3. **Refactor ObservabilityWebhookService** (after tests are adequate)
   - Change method signatures to accept ExecutionContext
   - Update all callers
   - Verify tests pass

### Long-Term (1-2 months):
1. **Complete testing-coverage refactoring** (api-002, api-007, api-012, api-015, api-017, etc.)
2. **Implement llm-service-refactor** (decompose monolithic LLM service)
3. **Add E2E tests** for critical execution paths

---

## Quality Gates Status

- ✅ `npm run lint:api` - PASSING
- ✅ `npm run build:api` - PASSING
- ⚠️ Existing tests - PASSING (but coverage inadequate)

---

## Conclusion

**ExecutionContext Compliance Status: MOSTLY COMPLIANT**

The API codebase has good ExecutionContext compliance in agent execution paths:
- Agent runners correctly use ExecutionContext
- LLM service requires and validates ExecutionContext
- Intentional mutations are properly guarded

**Critical Gap:** ObservabilityWebhookService needs refactoring but is blocked by missing tests.

**Next Steps:**
1. Create tests for ObservabilityWebhookService
2. Refactor ObservabilityWebhookService to accept ExecutionContext
3. Close false positive issues
4. Move to next refactoring: transport-types-compliance

**Overall Health:** FAIR (blocked by test coverage gaps, not architectural issues)
