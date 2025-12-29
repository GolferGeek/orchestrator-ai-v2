# Issue api-014: ObservabilityWebhookService ExecutionContext Refactoring

**Status:** BLOCKED - Awaiting Test Coverage
**Priority:** HIGH
**Category:** execution-context
**File:** `apps/api/src/observability/observability-webhook.service.ts`

---

## Problem

The `ObservabilityWebhookService` violates the ExecutionContext capsule pattern by accepting individual fields instead of the complete ExecutionContext object as the first parameter.

### Current Implementation

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

async emitAgentCompleted(params: {
  userId: string;
  conversationId?: string;
  taskId: string;
  agentSlug: string;
  organizationSlug?: string;
  mode: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration?: number;
}): Promise<void> {
  await this.sendEvent({
    source_app: 'orchestrator-ai',
    session_id: params.conversationId || params.taskId,
    hook_event_type: params.success ? 'agent.completed' : 'agent.failed',
    userId: params.userId,
    conversationId: params.conversationId,
    taskId: params.taskId,
    agentSlug: params.agentSlug,
    organizationSlug: params.organizationSlug,
    mode: params.mode,
    payload: {
      success: params.success,
      result: params.result,
      error: params.error,
      duration: params.duration,
    },
  });
}

async emitAgentProgress(params: {
  userId: string;
  conversationId?: string;
  taskId: string;
  agentSlug: string;
  organizationSlug?: string;
  mode: string;
  message: string;
  progress?: number;
  step?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await this.sendEvent({
    source_app: 'orchestrator-ai',
    session_id: params.conversationId || params.taskId,
    hook_event_type: 'agent.progress',
    userId: params.userId,
    conversationId: params.conversationId,
    taskId: params.taskId,
    agentSlug: params.agentSlug,
    organizationSlug: params.organizationSlug,
    mode: params.mode,
    payload: {
      message: params.message,
      progress: params.progress,
      step: params.step,
      ...params.metadata,
    },
  });
}

async emitOrchestrationStep(params: {
  userId: string;
  conversationId?: string;
  taskId: string;
  orchestrationRunId: string;
  stepId: string;
  stepName: string;
  status: 'started' | 'completed' | 'failed';
  agentSlug?: string;
  error?: string;
  duration?: number;
}): Promise<void> {
  await this.sendEvent({
    source_app: 'orchestrator-ai',
    session_id: params.conversationId || params.taskId,
    hook_event_type: `orchestration.step.${params.status}`,
    userId: params.userId,
    conversationId: params.conversationId,
    taskId: params.taskId,
    agentSlug: params.agentSlug,
    payload: {
      orchestrationRunId: params.orchestrationRunId,
      stepId: params.stepId,
      stepName: params.stepName,
      status: params.status,
      error: params.error,
      duration: params.duration,
    },
  });
}
```

### Why This is a Problem

From **execution-context-skill**:

> **ExecutionContext is a complete, immutable "capsule"** that contains all context needed for any operation. It must **always be passed as a whole**, never as individual fields.

> ❌ DON'T: Pass Individual Fields
> ```typescript
> async createTask(
>   userId: string,
>   conversationId: string,
>   taskId: string,
>   dto: CreateTaskDto
> ): Promise<Task>
> ```
>
> ✅ GOOD: Pass the whole capsule
> ```typescript
> async createTask(
>   context: ExecutionContext,
>   dto: CreateTaskDto
> ): Promise<Task>
> ```

**Current Issues:**
1. **Cherry-picking fields** - Methods extract individual fields from ExecutionContext before calling
2. **Future-proofing** - If ExecutionContext gains new fields, all call sites must be updated
3. **Observability consistency** - Missing fields in some calls (not all pass organizationSlug)
4. **Inconsistent patterns** - Different from other services (LLMService, streaming, etc.)

---

## Proposed Solution

Refactor all event emission methods to accept `ExecutionContext` as the first parameter.

### New Implementation

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class ObservabilityWebhookService implements OnModuleInit {
  private readonly logger = new Logger(ObservabilityWebhookService.name);

  // ... existing cache and constructor code ...

  /**
   * Send an agent started event
   * @param context - Full ExecutionContext from request
   * @param mode - Agent mode (converse, plan, build, hitl)
   * @param payload - Additional event payload
   */
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

  /**
   * Send an agent completed event
   * @param context - Full ExecutionContext from request
   * @param mode - Agent mode
   * @param success - Whether agent execution succeeded
   * @param result - Execution result
   * @param error - Error message if failed
   * @param duration - Execution duration in ms
   */
  async emitAgentCompleted(
    context: ExecutionContext,
    mode: string,
    success: boolean,
    result?: unknown,
    error?: string,
    duration?: number,
  ): Promise<void> {
    await this.sendEvent({
      source_app: 'orchestrator-ai',
      session_id: context.conversationId || context.taskId,
      hook_event_type: success ? 'agent.completed' : 'agent.failed',
      userId: context.userId,
      conversationId: context.conversationId,
      taskId: context.taskId,
      agentSlug: context.agentSlug,
      organizationSlug: context.orgSlug,
      mode: mode,
      payload: {
        success,
        result,
        error,
        duration,
      },
    });
  }

  /**
   * Send an agent progress event
   * @param context - Full ExecutionContext from request
   * @param mode - Agent mode
   * @param message - Progress message
   * @param progress - Progress percentage (0-100)
   * @param step - Current step name
   * @param metadata - Additional metadata
   */
  async emitAgentProgress(
    context: ExecutionContext,
    mode: string,
    message: string,
    progress?: number,
    step?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.sendEvent({
      source_app: 'orchestrator-ai',
      session_id: context.conversationId || context.taskId,
      hook_event_type: 'agent.progress',
      userId: context.userId,
      conversationId: context.conversationId,
      taskId: context.taskId,
      agentSlug: context.agentSlug,
      organizationSlug: context.orgSlug,
      mode: mode,
      payload: {
        message,
        progress,
        step,
        ...metadata,
      },
    });
  }

  /**
   * Send an orchestration step event
   * @param context - Full ExecutionContext from request
   * @param orchestrationRunId - Orchestration run identifier
   * @param stepId - Step identifier
   * @param stepName - Step name
   * @param status - Step status (started, completed, failed)
   * @param error - Error message if failed
   * @param duration - Step duration in ms
   */
  async emitOrchestrationStep(
    context: ExecutionContext,
    orchestrationRunId: string,
    stepId: string,
    stepName: string,
    status: 'started' | 'completed' | 'failed',
    error?: string,
    duration?: number,
  ): Promise<void> {
    await this.sendEvent({
      source_app: 'orchestrator-ai',
      session_id: context.conversationId || context.taskId,
      hook_event_type: `orchestration.step.${status}`,
      userId: context.userId,
      conversationId: context.conversationId,
      taskId: context.taskId,
      agentSlug: context.agentSlug,
      organizationSlug: context.orgSlug,
      payload: {
        orchestrationRunId,
        stepId,
        stepName,
        status,
        error,
        duration,
      },
    });
  }

  // ... rest of the service remains the same ...
}
```

### Call Site Updates

**Before:**
```typescript
await this.observabilityService.emitAgentStarted({
  userId: request.context.userId,
  conversationId: request.context.conversationId,
  taskId: request.context.taskId,
  agentSlug: request.context.agentSlug,
  organizationSlug: request.context.orgSlug,
  mode: 'converse',
  payload: { message: 'Starting agent' },
});
```

**After:**
```typescript
await this.observabilityService.emitAgentStarted(
  request.context,  // Pass full context
  'converse',
  { message: 'Starting agent' },
);
```

---

## Required Test Coverage

Before implementing this refactoring, the following tests MUST be added:

### Unit Tests (Target: ≥75% coverage)

1. **Username Resolution Tests:**
   - Test cache hit scenario
   - Test cache miss scenario (database lookup)
   - Test cache expiration (after TTL)
   - Test missing userId (returns undefined)
   - Test database error handling

2. **Event Emission Tests:**
   - Test `emitAgentStarted()` with full context
   - Test `emitAgentCompleted()` success scenario
   - Test `emitAgentCompleted()` failure scenario
   - Test `emitAgentProgress()` with progress percentage
   - Test `emitAgentProgress()` with step information
   - Test `emitOrchestrationStep()` for all statuses

3. **SSE Streaming Tests:**
   - Test `sendEvent()` constructs correct payload
   - Test event sent to observability endpoint
   - Test non-blocking behavior (failures don't throw)
   - Test error logging on failure

4. **ExecutionContext Integration Tests:**
   - Test all context fields are preserved (userId, conversationId, taskId, agentSlug, orgSlug)
   - Test optional fields handled correctly (conversationId fallback to taskId)
   - Test ExecutionContext mutation doesn't affect service

### Integration Tests (Target: ≥70% coverage)

1. **End-to-End Event Flow:**
   - Test event sent through HTTP to observability server
   - Test SSE client receives event
   - Test event persisted to database
   - Test username enrichment in event

2. **Error Scenarios:**
   - Test observability server unavailable
   - Test network timeout
   - Test invalid event payload
   - Test database unavailable for username lookup

### Test File Structure

```
apps/api/src/observability/
├── observability-webhook.service.ts
├── observability-webhook.service.spec.ts  <-- ADD THIS
├── observability-events.service.ts
├── observability-events.service.spec.ts   <-- ADD THIS
└── __tests__/
    └── observability-integration.spec.ts  <-- ADD THIS
```

---

## Implementation Steps

### Phase 1: Add Tests (2-3 days)

1. Create `observability-webhook.service.spec.ts`
2. Add unit tests for all methods (15-20 tests)
3. Create `observability-integration.spec.ts`
4. Add integration tests (5-10 tests)
5. Run coverage report - verify ≥75% lines, ≥70% branches
6. Fix any gaps in coverage

### Phase 2: Refactor Service (1 day)

1. Update method signatures to accept `ExecutionContext`
2. Simplify method implementations (extract fields from context)
3. Update JSDoc comments
4. Run tests - verify all pass

### Phase 3: Update Call Sites (1-2 days)

1. Find all callers: `grep -r "emitAgent" apps/api/src/`
2. Update each call site to pass full context
3. Run tests after each update
4. Verify no breaking changes

### Phase 4: Validation (1 day)

1. Run full test suite: `npm run test`
2. Run linter: `npm run lint:api`
3. Run build: `npm run build:api`
4. Manual testing of SSE streaming
5. Verify observability events in production

**Total Estimated Effort:** 5-7 days

---

## Files to Update

### Service Files
- `apps/api/src/observability/observability-webhook.service.ts` - Refactor method signatures
- `apps/api/src/observability/observability-events.service.ts` - May need similar refactoring

### Call Sites (grep results)
```bash
grep -r "emitAgent\|emitOrchestration" apps/api/src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected locations:
- `apps/api/src/agent2agent/services/base-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/context-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/api-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/external-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/rag-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/media-agent-runner.service.ts`
- LangGraph services (if any)

---

## Success Criteria

✅ All tests pass (`npm run test`)
✅ Test coverage ≥75% lines, ≥70% branches for observability services
✅ Linter passes (`npm run lint:api`)
✅ Build succeeds (`npm run build:api`)
✅ All call sites updated to use ExecutionContext
✅ No breaking changes to observability event format
✅ SSE streaming continues to work
✅ Manual verification: observability events appear in production

---

## Related

- **Refactoring:** execution-context-compliance
- **Skill:** execution-context-skill
- **Monitoring Report:** `.monitor/apps-api.json`
- **Related Issues:** None (this is the only observability ExecutionContext issue)

---

## Notes

- This is a **breaking change** for internal callers, but not for external consumers
- SSE event format remains unchanged (backwards compatible)
- Database schema unchanged
- Observability server API unchanged
- Only internal service method signatures change
- All changes are internal to the API application
- No changes to transport types
- No changes to frontend

**Priority Justification:** HIGH - Observability is critical for monitoring agent execution. ExecutionContext compliance ensures all observability events have complete context for debugging and analytics.
