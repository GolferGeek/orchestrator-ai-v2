# Execution Context Refactor Plan

## Executive Summary

Create a single `ExecutionContext` type that is:
1. **Created by the frontend** with every request
2. **Passed through the entire backend** - controllers, runners, services, LLM calls, observability
3. **Always available** - no lookups, no piecing together from different sources

This solves observability gaps, simplifies parameter passing, and prepares for orchestrator multi-task scenarios.

---

## The Context

```typescript
/**
 * Execution context - created by frontend, flows through entire system
 * Every backend function that does work takes this as a parameter
 */
export interface ExecutionContext {
  // === Always Required ===
  orgSlug: string;
  userId: string;

  // === Required for most operations ===
  conversationId: string;

  // === Present when applicable ===
  taskId?: string;
  deliverableId?: string;

  // === Agent info (set by backend after routing) ===
  agentSlug?: string;
  agentType?: string;
}
```

---

## The Strategy

**Every function takes `ExecutionContext`** - even if it doesn't use all fields.

```typescript
// YES - always pass full context
async createDeliverable(context: ExecutionContext, dto: CreateDeliverableDto)
async callLLM(context: ExecutionContext, prompt: string, options: LLMOptions)
async logEvent(context: ExecutionContext, eventType: string, data: any)

// NO - don't cherry-pick fields
async createDeliverable(userId: string, conversationId: string, dto: CreateDeliverableDto)
```

**Why:**
- No refactors when you need another field
- Observability always has full context
- Consistent pattern everywhere

---

## Phase 1: Transport Types & Frontend

### 1.1 Define ExecutionContext in Transport Types

**File:** `apps/transport-types/core/execution-context.ts`

```typescript
/**
 * Execution context - created by frontend, flows through entire system
 */
export interface ExecutionContext {
  /** Organization slug */
  orgSlug: string;

  /** User ID (from auth) */
  userId: string;

  /** Conversation ID */
  conversationId: string;

  /** Task ID (if exists) */
  taskId?: string;

  /** Deliverable ID (if exists) */
  deliverableId?: string;

  /** Agent slug (set by backend after routing) */
  agentSlug?: string;

  /** Agent type (set by backend after routing) */
  agentType?: string;
}

/**
 * Create a minimal context (for new conversations)
 */
export function createExecutionContext(
  orgSlug: string,
  userId: string,
  conversationId: string,
): ExecutionContext {
  return { orgSlug, userId, conversationId };
}

/**
 * Extend context with task/deliverable info
 */
export function extendContext(
  context: ExecutionContext,
  extensions: Partial<Pick<ExecutionContext, 'taskId' | 'deliverableId' | 'agentSlug' | 'agentType'>>,
): ExecutionContext {
  return { ...context, ...extensions };
}
```

### 1.2 Update A2A Request Types

**File:** `apps/transport-types/a2a/request.types.ts`

```typescript
export interface A2ARequestParams {
  /** Execution context - always present */
  context: ExecutionContext;

  /** Message payload */
  message?: {
    text: string;
    parts?: MessagePart[];
  };

  /** Mode for task execution */
  mode?: 'build' | 'converse';

  /** HITL-specific params */
  taskId?: string;
  decision?: HitlDecision;
  feedback?: string;
  editedContent?: HitlGeneratedContent;
}

export interface A2ARequest {
  jsonrpc: '2.0';
  method: string;
  params: A2ARequestParams;
  id: string | number;
}
```

### 1.3 Export from Transport Types

**File:** `apps/transport-types/index.ts`

```typescript
// Core
export type { ExecutionContext } from './core/execution-context';
export { createExecutionContext, extendContext } from './core/execution-context';
```

### 1.4 Create Frontend Context Builder

**File:** `apps/web/src/utils/executionContext.ts`

```typescript
import { useAuthStore } from '@/stores/authStore';
import { useOrganizationStore } from '@/stores/organizationStore';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * Build execution context from current frontend state
 */
export function buildExecutionContext(
  conversationId: string,
  options?: {
    taskId?: string;
    deliverableId?: string;
  }
): ExecutionContext {
  const authStore = useAuthStore();
  const orgStore = useOrganizationStore();

  if (!authStore.userId) {
    throw new Error('User not authenticated');
  }

  if (!orgStore.currentOrganization?.slug) {
    throw new Error('No organization selected');
  }

  return {
    orgSlug: orgStore.currentOrganization.slug,
    userId: authStore.userId,
    conversationId,
    taskId: options?.taskId,
    deliverableId: options?.deliverableId,
  };
}
```

### 1.5 Update Frontend Services

Update all services that call the A2A endpoint to include context:

**File:** `apps/web/src/services/agentService.ts` (example)

```typescript
import { buildExecutionContext } from '@/utils/executionContext';

async sendMessage(
  agentSlug: string,
  conversationId: string,
  message: string,
  options?: { taskId?: string; deliverableId?: string; mode?: 'build' | 'converse' }
): Promise<A2AResponse> {
  const context = buildExecutionContext(conversationId, options);

  return this.callA2A(agentSlug, 'tasks/send', {
    context,
    message: { text: message },
    mode: options?.mode || 'build',
  });
}
```

**Files to update:**
- `apps/web/src/services/agentService.ts`
- `apps/web/src/services/hitlService.ts`
- `apps/web/src/services/conversationService.ts`
- Any other service that calls A2A endpoints

---

## Phase 2: Backend Controller & Mode Router

### 2.1 Update A2A Controller

**File:** `apps/api/src/agent2agent/agent2agent.controller.ts`

```typescript
@Post(':orgSlug/:agentSlug/tasks')
async handleTask(
  @Param('orgSlug') orgSlug: string,
  @Param('agentSlug') agentSlug: string,
  @Body() body: A2ARequest,
  @Req() req: AuthenticatedRequest,
): Promise<A2AResponse> {
  // Extract context from request params
  const context: ExecutionContext = {
    ...body.params.context,
    // Backend sets agent info
    agentSlug,
    // Validate orgSlug matches
    orgSlug: body.params.context.orgSlug === orgSlug
      ? orgSlug
      : throw new BadRequestException('orgSlug mismatch'),
    // Validate userId matches auth
    userId: body.params.context.userId === req.user.sub
      ? req.user.sub
      : throw new BadRequestException('userId mismatch'),
  };

  return this.modeRouter.route(context, agentSlug, body);
}
```

### 2.2 Update Mode Router

**File:** `apps/api/src/agent2agent/services/agent-mode-router.service.ts`

```typescript
async route(
  context: ExecutionContext,
  agentSlug: string,
  request: A2ARequest,
): Promise<A2AResponse> {
  // Look up agent
  const agent = await this.agentService.findBySlug(agentSlug, context.orgSlug);

  // Extend context with agent type
  const enrichedContext = extendContext(context, {
    agentType: agent.type,
    agentSlug: agent.slug,
  });

  // Get appropriate runner
  const runner = this.runnerRegistry.getRunner(agent.type);

  // Execute with context
  return runner.execute(enrichedContext, agent, request);
}
```

---

## Phase 3: All Runners

Update every runner to take `ExecutionContext` as first parameter.

### 3.1 Base Runner Interface

**File:** `apps/api/src/agent2agent/interfaces/runner.interface.ts`

```typescript
export interface AgentRunner {
  execute(
    context: ExecutionContext,
    agent: AgentRuntimeDefinition,
    request: A2ARequest,
  ): Promise<A2AResponse>;
}
```

### 3.2 Update Each Runner

**Files:**
- `apps/api/src/agent2agent/services/api-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/context-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/external-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`
- `apps/api/src/agent2agent/services/rag-agent-runner.service.ts`

Example pattern for each:

```typescript
@Injectable()
export class ApiAgentRunnerService implements AgentRunner {
  async execute(
    context: ExecutionContext,
    agent: AgentRuntimeDefinition,
    request: A2ARequest,
  ): Promise<A2AResponse> {
    // Use context everywhere
    this.logger.log(`Executing ${agent.slug} for user ${context.userId}`);

    // Pass to LLM
    const llmResponse = await this.llmService.call(context, prompt, options);

    // Pass to deliverables
    const deliverable = await this.deliverablesService.create(context, dto);

    // Pass to observability
    await this.observability.logEvent(context, 'agent.execute', { agentSlug: agent.slug });

    // Pass to LangGraph
    const graphResponse = await this.invokeLangGraph(context, agent, input);

    return response;
  }
}
```

---

## Phase 4: Core Services

Update all services that do work to take `ExecutionContext`.

### 4.1 LLM Service

**File:** `apps/api/src/llms/llm.service.ts`

```typescript
async call(
  context: ExecutionContext,
  prompt: string,
  options: LLMCallOptions,
): Promise<LLMResponse> {
  // Log with full context
  await this.observability.logEvent(context, 'llm.call.start', {
    provider: options.provider,
    model: options.model,
  });

  // Make call...

  // Log completion with full context
  await this.observability.logEvent(context, 'llm.call.complete', {
    tokens: response.usage,
    duration: elapsed,
  });

  return response;
}
```

### 4.2 Deliverables Service

**File:** `apps/api/src/agent2agent/deliverables/deliverables.service.ts`

```typescript
async create(
  context: ExecutionContext,
  dto: CreateDeliverableDto,
): Promise<Deliverable> {
  return this.repository.create({
    ...dto,
    userId: context.userId,
    conversationId: context.conversationId,
    // organizationSlug if needed
  });
}

async findByConversation(context: ExecutionContext): Promise<Deliverable[]> {
  return this.repository.find({
    conversationId: context.conversationId,
    userId: context.userId,
  });
}
```

### 4.3 Tasks Service

**File:** `apps/api/src/agent2agent/services/agent-tasks.service.ts`

```typescript
async create(
  context: ExecutionContext,
  dto: CreateTaskDto,
): Promise<Task> {
  const task = await this.repository.create({
    ...dto,
    userId: context.userId,
    conversationId: context.conversationId,
  });

  // Update context with new taskId for downstream use
  // (caller should use extendContext)

  return task;
}
```

### 4.4 Conversations Service

**File:** `apps/api/src/agent2agent/services/agent-conversations.service.ts`

```typescript
async create(
  context: Omit<ExecutionContext, 'conversationId'>,
  dto: CreateConversationDto,
): Promise<Conversation> {
  return this.repository.create({
    ...dto,
    userId: context.userId,
    organizationSlug: context.orgSlug,
  });
}
```

### 4.5 Observability Service

**File:** `apps/api/src/observability/observability.service.ts`

```typescript
async logEvent(
  context: ExecutionContext,
  eventType: string,
  data: Record<string, any>,
): Promise<void> {
  await this.repository.insert({
    eventType,
    sourceApp: 'api',
    userId: context.userId,
    conversationId: context.conversationId,
    taskId: context.taskId,
    deliverableId: context.deliverableId,
    agentSlug: context.agentSlug,
    orgSlug: context.orgSlug,
    eventData: data,
    createdAt: new Date(),
  });
}
```

---

## Phase 5: LangGraph Integration

### 5.1 Pass Context to LangGraph

When calling LangGraph, include context in the input:

```typescript
private async invokeLangGraph(
  context: ExecutionContext,
  agent: AgentRuntimeDefinition,
  userMessage: string,
): Promise<LangGraphResponse> {
  const input = {
    // Context becomes part of state
    taskId: context.taskId,
    userId: context.userId,
    conversationId: context.conversationId,
    organizationSlug: context.orgSlug,

    // User input
    userMessage,
  };

  const response = await this.httpService.post(
    `${agent.endpoint}/invoke`,
    {
      input,
      config: {
        configurable: {
          thread_id: context.taskId,
        },
      },
    },
  );

  return response.data;
}
```

### 5.2 LangGraph State Already Has These Fields

The `HitlBaseStateAnnotation` already has:
- `taskId`
- `userId`
- `conversationId`
- `organizationSlug`

So context naturally flows into LangGraph state.

---

## Phase 6: Cleanup & Validation

### 6.1 Remove Old Parameter Patterns

Search for and update any remaining patterns like:
- `userId: string, conversationId: string` as separate params
- Services looking up context from request objects
- Observability calls missing fields

### 6.2 Add Validation

Ensure context is validated at the entry point (A2A controller):
- `orgSlug` matches route param
- `userId` matches auth token
- `conversationId` is a valid UUID

### 6.3 Update Tests

Update all tests to pass `ExecutionContext` objects.

---

## Files to Modify

### Transport Types (New/Modified)
| File | Action |
|------|--------|
| `apps/transport-types/core/execution-context.ts` | CREATE |
| `apps/transport-types/a2a/request.types.ts` | MODIFY |
| `apps/transport-types/index.ts` | MODIFY |

### Frontend (New/Modified)
| File | Action |
|------|--------|
| `apps/web/src/utils/executionContext.ts` | CREATE |
| `apps/web/src/services/agentService.ts` | MODIFY |
| `apps/web/src/services/hitlService.ts` | MODIFY |
| `apps/web/src/services/conversationService.ts` | MODIFY |

### Backend - Controllers
| File | Action |
|------|--------|
| `apps/api/src/agent2agent/agent2agent.controller.ts` | MODIFY |

### Backend - Runners
| File | Action |
|------|--------|
| `apps/api/src/agent2agent/services/agent-mode-router.service.ts` | MODIFY |
| `apps/api/src/agent2agent/services/api-agent-runner.service.ts` | MODIFY |
| `apps/api/src/agent2agent/services/context-agent-runner.service.ts` | MODIFY |
| `apps/api/src/agent2agent/services/external-agent-runner.service.ts` | MODIFY |
| `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts` | MODIFY |
| `apps/api/src/agent2agent/services/rag-agent-runner.service.ts` | MODIFY |

### Backend - Services
| File | Action |
|------|--------|
| `apps/api/src/llms/llm.service.ts` | MODIFY |
| `apps/api/src/agent2agent/deliverables/deliverables.service.ts` | MODIFY |
| `apps/api/src/agent2agent/deliverables/deliverable-versions.service.ts` | MODIFY |
| `apps/api/src/agent2agent/services/agent-tasks.service.ts` | MODIFY |
| `apps/api/src/agent2agent/services/agent-conversations.service.ts` | MODIFY |
| `apps/api/src/observability/observability.service.ts` | MODIFY |

---

## Success Criteria

1. [ ] `ExecutionContext` type defined in transport-types
2. [ ] Frontend creates context with every A2A request
3. [ ] A2A controller extracts and validates context
4. [ ] All runners take `ExecutionContext` as first param
5. [ ] All services take `ExecutionContext` as first param
6. [ ] LLM calls include full context
7. [ ] Observability always has complete context
8. [ ] LangGraph receives context in state
9. [ ] All tests updated and passing
10. [ ] Build passes: `npm run build`

---

## Estimated Scope

- **Transport types:** Small (1 new file, 2 updates)
- **Frontend:** Medium (1 new file, 3-5 service updates)
- **Backend controllers:** Small (1-2 files)
- **Backend runners:** Medium (5-6 files, but pattern is the same)
- **Backend services:** Medium (6-8 files)
- **Tests:** Medium (update test fixtures)

The changes are **wide but shallow** - adding a parameter and passing it through. The pattern is the same everywhere, so it should go quickly once the first few are done.
