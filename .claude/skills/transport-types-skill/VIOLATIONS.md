# Transport Types Violations

This document provides detailed examples of common transport type violations and how to fix them.

## Violation Type 1: Custom Fields in Payloads

### Example 1.1: Adding Undefined Fields

**❌ Violation:**
```typescript
// Adding field not in PlanCreatePayload
const payload = {
  action: 'create',
  title: 'My Plan',
  customField: 'value',  // NOT in transport types!
  anotherCustomField: 123,  // NOT in transport types!
};
```

**✅ Fix:**
```typescript
import { PlanCreatePayload } from '@orchestrator-ai/transport-types';

const payload: PlanCreatePayload = {
  action: 'create',
  title: 'My Plan',
  // Only fields defined in PlanCreatePayload:
  // - action: 'create' (required)
  // - title?: string (optional)
  // - content?: string (optional)
  // - forceNew?: boolean (optional)
};
```

### Example 1.2: Using Wrong Field Names

**❌ Violation:**
```typescript
// Using wrong field name
const payload = {
  action: 'create',
  planTitle: 'My Plan',  // Should be 'title', not 'planTitle'
};
```

**✅ Fix:**
```typescript
import { PlanCreatePayload } from '@orchestrator-ai/transport-types';

const payload: PlanCreatePayload = {
  action: 'create',
  title: 'My Plan',  // Correct field name from transport types
};
```

## Violation Type 2: Missing Required Fields

### Example 2.1: Missing ExecutionContext

**❌ Violation:**
```typescript
// Missing context in params
const request = {
  jsonrpc: '2.0',
  method: 'plan',
  id: 'task-uuid',
  params: {
    mode: 'plan',
    payload: { action: 'create' },
    userMessage: '',
    // Missing context!
  },
};
```

**✅ Fix:**
```typescript
import { A2ATaskRequest, ExecutionContext, AgentTaskMode } from '@orchestrator-ai/transport-types';

const context: ExecutionContext = useExecutionContextStore().current;

const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'plan',
  id: context.taskId,
  params: {
    context,  // REQUIRED - ExecutionContext capsule
    mode: AgentTaskMode.PLAN,
    payload: { action: 'create' },
    userMessage: '',
  },
};
```

### Example 2.2: Missing JSON-RPC Fields

**❌ Violation:**
```typescript
// Missing jsonrpc version
const request = {
  method: 'plan',
  id: 'task-uuid',
  params: { ... },
  // Missing jsonrpc: "2.0"!
};
```

**✅ Fix:**
```typescript
import { A2ATaskRequest } from '@orchestrator-ai/transport-types';

const request: A2ATaskRequest = {
  jsonrpc: '2.0',  // REQUIRED - must be exactly "2.0"
  method: 'plan',
  id: 'task-uuid',
  params: { ... },
};
```

### Example 2.3: Missing Payload Action

**❌ Violation:**
```typescript
// Missing action in payload
const request = {
  jsonrpc: '2.0',
  method: 'plan',
  id: 'task-uuid',
  params: {
    context: executionContext,
    mode: 'plan',
    payload: {
      title: 'My Plan',
      // Missing action!
    },
    userMessage: '',
  },
};
```

**✅ Fix:**
```typescript
import { PlanCreatePayload } from '@orchestrator-ai/transport-types';

const payload: PlanCreatePayload = {
  action: 'create',  // REQUIRED - must be first field
  title: 'My Plan',
};

const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'plan',
  id: 'task-uuid',
  params: {
    context: executionContext,
    mode: AgentTaskMode.PLAN,
    payload,
    userMessage: '',
  },
};
```

## Violation Type 3: Wrong JSON-RPC Structure

### Example 3.1: Custom Response Format

**❌ Violation:**
```typescript
// Custom response format instead of JSON-RPC
return {
  status: 'success',
  data: {
    plan: { ... },
    version: { ... },
  },
  // Not JSON-RPC format!
};
```

**✅ Fix:**
```typescript
import { A2ATaskSuccessResponse, TaskResponse } from '@orchestrator-ai/transport-types';

const response: A2ATaskSuccessResponse = {
  jsonrpc: '2.0',
  id: request.id,
  result: {
    success: true,
    mode: 'plan',
    payload: {
      content: {
        plan: { ... },
        version: { ... },
      },
      metadata: {
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        usage: { ... },
      },
    },
  },
};

return response;
```

### Example 3.2: Wrong Error Format

**❌ Violation:**
```typescript
// Custom error format
return {
  error: true,
  message: 'Something went wrong',
  // Not JSON-RPC error format!
};
```

**✅ Fix:**
```typescript
import { A2ATaskErrorResponse, JsonRpcErrorCode } from '@orchestrator-ai/transport-types';

const response: A2ATaskErrorResponse = {
  jsonrpc: '2.0',
  id: request.id,
  error: {
    code: JsonRpcErrorCode.INTERNAL_ERROR,
    message: 'Something went wrong',
    data: {
      // Additional error details
    },
  },
};

return response;
```

## Violation Type 4: Using Transport Types for Non-A2A Endpoints

### Example 4.1: Regular REST Endpoint

**❌ Violation:**
```typescript
// Using A2A types for regular REST endpoint
@Get('/api/conversations')
async getConversations(@Body() body: A2ATaskRequest): Promise<A2ATaskResponse> {
  // This is NOT an agent call - it's just data retrieval!
  // Don't use A2A transport types here
}
```

**✅ Fix:**
```typescript
// Regular REST endpoint - no transport types needed
@Get('/api/conversations')
async getConversations(@CurrentUser() user: User): Promise<Conversation[]> {
  // Regular REST response - not A2A protocol
  return await this.conversationsService.findByUser(user.id);
}
```

### Example 4.2: Front-End Data Fetching

**❌ Violation:**
```typescript
// Using A2A types for data fetching
const response = await axios.post('/api/users', {
  jsonrpc: '2.0',
  method: 'getUsers',
  params: { ... },
  // This is NOT an agent call!
});
```

**✅ Fix:**
```typescript
// Regular REST call - no transport types
const response = await axios.get('/api/users');
// or
const response = await axios.post('/api/users', {
  // Regular request body, not A2A format
  filters: { ... },
});
```

## Violation Type 5: Modifying Transport Types

### Example 5.1: Adding Fields to Transport Types

**❌ Violation:**
```typescript
// apps/transport-types/modes/plan.types.ts
export interface PlanCreatePayload {
  action: 'create';
  title?: string;
  content?: string;
  forceNew?: boolean;
  myNewField: string;  // BREAKS CONTRACT!
  // Adding fields without coordinating with frontend/backend
}
```

**✅ Fix:**
```typescript
// DON'T modify transport types directly!
// If you need new fields:
// 1. Coordinate with frontend/backend team
// 2. Update transport types package version
// 3. Update both frontend and backend simultaneously
// 4. Document the change in migration guide
```

## Violation Type 6: Type Assertions Bypassing Validation

### Example 6.1: Unsafe Type Assertions

**❌ Violation:**
```typescript
// Unsafe type assertion
const payload = req.body.params.payload as PlanCreatePayload;
// No validation - could be wrong structure!
```

**✅ Fix:**
```typescript
// Validate before using
import { isA2ATaskRequest } from '@orchestrator-ai/transport-types';

if (!isA2ATaskRequest(req.body)) {
  throw new BadRequestException('Invalid A2A request format');
}

const payload = req.body.params.payload;
if (payload.action !== 'create') {
  throw new BadRequestException('Invalid action');
}

// Now safe to use
const createPayload = payload as PlanCreatePayload;
```

## Violation Type 7: Wrong Mode/Action Combinations

### Example 7.1: Using Build Action in Plan Mode

**❌ Violation:**
```typescript
// Wrong action for mode
const request = {
  jsonrpc: '2.0',
  method: 'plan',  // Plan mode
  params: {
    context: executionContext,
    mode: 'plan',
    payload: {
      action: 'create',  // OK
      // But using build-specific fields
      deliverableType: 'blog-post',  // This is for BUILD mode!
    },
  },
};
```

**✅ Fix:**
```typescript
import { PlanCreatePayload, BuildCreatePayload } from '@orchestrator-ai/transport-types';

// For PLAN mode
const planPayload: PlanCreatePayload = {
  action: 'create',
  title: 'My Plan',
  // Only plan-specific fields
};

// For BUILD mode
const buildPayload: BuildCreatePayload = {
  action: 'create',
  title: 'My Deliverable',
  type: 'blog-post',  // OK for build mode
};
```

## Violation Type 8: Missing Metadata Fields

### Example 8.1: Incomplete Response Metadata

**❌ Violation:**
```typescript
// Missing required metadata fields
const response = {
  jsonrpc: '2.0',
  id: request.id,
  result: {
    success: true,
    mode: 'plan',
    payload: {
      content: { ... },
      metadata: {
        // Missing provider, model, usage!
      },
    },
  },
};
```

**✅ Fix:**
```typescript
import { PlanResponseMetadata } from '@orchestrator-ai/transport-types';

const metadata: PlanResponseMetadata = {
  provider: 'anthropic',  // REQUIRED
  model: 'claude-sonnet-4',  // REQUIRED
  usage: {  // REQUIRED
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    cost: 0.05,
  },
};

const response: A2ATaskSuccessResponse = {
  jsonrpc: '2.0',
  id: request.id,
  result: {
    success: true,
    mode: 'plan',
    payload: {
      content: { ... },
      metadata,
    },
  },
};
```

## Summary of Fix Patterns

1. **Use transport types**: Always import and use types from `@orchestrator-ai/transport-types`
2. **Validate at boundaries**: Check request/response structure at API entry points
3. **Don't add custom fields**: Only use fields defined in transport types
4. **Include all required fields**: Check transport type definitions for required vs optional
5. **Use correct mode/action**: Ensure action matches the mode (plan actions for plan mode, etc.)
6. **Follow JSON-RPC structure**: Always use JSON-RPC 2.0 format for A2A requests/responses
7. **Don't modify transport types**: Coordinate changes across frontend/backend
8. **Separate A2A from REST**: Don't use transport types for non-A2A endpoints

