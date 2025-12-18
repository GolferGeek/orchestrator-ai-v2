# Execution Context Violations

This document provides detailed examples of common ExecutionContext violations and how to fix them.

## Violation Type 1: Individual Parameters Instead of Context

### Example 1.1: Service Method

**❌ Violation:**
```typescript
// apps/api/src/agent2agent/tasks/tasks.service.ts
async createTask(
  userId: string,
  agentName: string,
  agentType: AgentType,
  dto: CreateTaskDto,
): Promise<Task> {
  // Uses userId directly
  const taskData: TaskRow = {
    user_id: userId,
    // ...
  };
}
```

**✅ Fix:**
```typescript
async createTask(
  context: ExecutionContext,
  agentName: string,
  agentType: AgentType,
  dto: CreateTaskDto,
): Promise<Task> {
  const taskData: TaskRow = {
    user_id: context.userId,
    conversation_id: context.conversationId,
    // ... other fields from context
  };
}
```

### Example 1.2: Helper Function

**❌ Violation:**
```typescript
// apps/api/src/agent2agent/services/base-agent-runner/shared.helpers.ts
export function resolveUserId(request: TaskRequestDto): string | null {
  // Extracts userId from various sources
  if (typeof request.context?.userId === 'string') {
    return request.context.userId;
  }
  // ... fallback logic
}
```

**✅ Fix:**
```typescript
// Don't extract - use context directly
// If context is missing, that's a validation error, not a fallback scenario
export function getExecutionContext(request: TaskRequestDto): ExecutionContext {
  if (!request.context) {
    throw new Error('ExecutionContext is required in request');
  }
  return request.context;
}
```

## Violation Type 2: Destructuring Before Passing

### Example 2.1: Controller Method

**❌ Violation:**
```typescript
// apps/api/src/agent2agent/agent2agent.controller.ts
async executeTask(@Body() body: FrontendTaskRequest): Promise<TaskResponseDto> {
  const context = body.context;
  
  // Destructuring individual fields
  const userId = context.userId;
  const conversationId = context.conversationId;
  const taskId = context.taskId;
  
  // Passing individual fields
  await this.tasksService.getOrCreateTask(
    { userId, orgSlug: context.orgSlug, conversationId },
    context.agentSlug,
    { taskId, ... }
  );
}
```

**✅ Fix:**
```typescript
async executeTask(@Body() body: FrontendTaskRequest): Promise<TaskResponseDto> {
  const context = body.context; // Use whole capsule
  
  // Pass whole context
  await this.tasksService.getOrCreateTask(context, context.agentSlug, {
    method: dto.mode,
    prompt: dto.userMessage || '',
    taskId: context.taskId, // Only extract if service needs it for specific field
    // ... but service should receive full context
  });
}
```

### Example 2.2: Observability Call

**❌ Violation:**
```typescript
// Extracting fields for observability
const { userId, conversationId, taskId } = context;
await this.observabilityService.logEvent('task.started', {
  userId,
  conversationId,
  taskId,
  // Missing orgSlug, agentSlug, etc.
});
```

**✅ Fix:**
```typescript
// Pass full context
await this.observabilityService.logEvent(context, 'task.started', {
  // Additional event-specific data only
});
```

## Violation Type 3: Constructing Context in Backend

### Example 3.1: Building Context from Request

**❌ Violation:**
```typescript
// apps/api/src/agent2agent/services/base-agent-runner/converse.handlers.ts
export async function executeConverse(
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const userId = resolveUserId(request);
  const existingConversationId = resolveConversationId(request);
  const orgSlug = organizationSlug ?? 'global';
  
  // Constructing context from pieces
  const context: ExecutionContext = {
    orgSlug,
    userId: userId!,
    conversationId: conversation.id,
    taskId: request.context?.taskId || NIL_UUID,
    // ... piecing together
  };
}
```

**✅ Fix:**
```typescript
export async function executeConverse(
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  // Use context from request - it's already complete
  const context = request.context;
  
  if (!context) {
    throw new Error('ExecutionContext is required');
  }
  
  // Only update conversationId if backend created a new one
  if (context.conversationId !== conversation.id) {
    // Create new context object (immutable update)
    const updatedContext: ExecutionContext = {
      ...context,
      conversationId: conversation.id,
    };
    // Use updatedContext for rest of function
  }
}
```

## Violation Type 4: Missing Context in LLM Calls

### Example 4.1: LLM Service Call

**❌ Violation:**
```typescript
// Calling LLM without full context
const response = await this.llmService.generateResponse(
  systemPrompt,
  userMessage,
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    // Missing userId, conversationId, taskId for observability
  }
);
```

**✅ Fix:**
```typescript
// Pass full context
const response = await this.llmService.generateResponse(
  context, // Full ExecutionContext
  systemPrompt,
  userMessage,
  {
    // Options can still include provider/model, but context is primary source
  }
);
```

## Violation Type 5: Observability Missing Fields

### Example 5.1: Partial Context in Events

**❌ Violation:**
```typescript
// apps/api/src/webhooks/webhooks.controller.ts
const { userId, conversationId, agentSlug, orgSlug } = update.context;

await this.observabilityEventsService.pushEvent({
  userId,
  conversationId,
  taskId: update.taskId,
  // Missing: planId, deliverableId, provider, model
});
```

**✅ Fix:**
```typescript
// Pass full context
await this.observabilityEventsService.pushEvent(
  update.context, // Full ExecutionContext
  'task.status.update',
  {
    taskId: update.taskId,
    status: update.status,
    // Event-specific data only
  }
);
```

## Violation Type 6: LangGraph Not Receiving Context

### Example 6.1: LangGraph Invocation

**❌ Violation:**
```typescript
// Invoking LangGraph with individual fields
const response = await this.httpService.post(`${agent.endpoint}/invoke`, {
  input: {
    taskId: context.taskId,
    userId: context.userId,
    conversationId: context.conversationId,
    userMessage: message,
    // Missing: orgSlug, agentSlug, provider, model, etc.
  },
});
```

**✅ Fix:**
```typescript
// Pass full context in input
const response = await this.httpService.post(`${agent.endpoint}/invoke`, {
  input: {
    context: context, // Full ExecutionContext
    userMessage: message,
  },
  config: {
    configurable: {
      thread_id: context.taskId,
    },
  },
});
```

## Violation Type 7: Service Methods Taking Individual Fields

### Example 7.1: RBAC Service

**❌ Violation:**
```typescript
// apps/api/src/rbac/rbac.service.ts
async checkPermission(
  userId: string,
  permission: string,
  resourceId?: string,
): Promise<boolean> {
  // Only has userId, missing orgSlug, conversationId for audit logging
}
```

**✅ Fix:**
```typescript
async checkPermission(
  context: ExecutionContext,
  permission: string,
  resourceId?: string,
): Promise<boolean> {
  // Now has full context for audit logging
  await this.auditLog.log(context, 'permission.check', {
    permission,
    resourceId,
  });
  
  // Use context.userId and context.orgSlug
  return await this.permissionRepository.check(
    context.userId,
    context.orgSlug,
    permission,
    resourceId,
  );
}
```

## Summary of Fix Patterns

1. **Update function signature**: Replace individual parameters with `context: ExecutionContext`
2. **Update function body**: Use `context.fieldName` instead of individual parameters
3. **Update all callers**: Pass `context` instead of individual fields
4. **Remove extraction logic**: Don't extract fields before passing - pass the whole capsule
5. **Remove construction logic**: Don't build ExecutionContext in backend - use from request
6. **Update observability**: Always pass full context, not individual fields
7. **Update LLM calls**: Always include ExecutionContext parameter
8. **Update LangGraph**: Include full context in input, not individual fields

