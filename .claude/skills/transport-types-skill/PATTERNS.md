# Transport Types Correct Patterns

This document provides detailed examples of correct transport type usage patterns.

## Front-End: Building A2A Requests

```typescript
import {
  A2ATaskRequest,
  AgentTaskMode,
  ExecutionContext,
  PlanCreatePayload,
} from '@orchestrator-ai/transport-types';
import { useExecutionContextStore } from '@/stores/executionContextStore';

// Get context from store
const context = useExecutionContextStore().current;

// Build mode-specific payload
const payload: PlanCreatePayload = {
  action: 'create',
  title: 'My Plan',
  // Only fields from PlanCreatePayload
};

// Build A2A request
const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'plan',  // Maps to AgentTaskMode.PLAN
  id: context.taskId,
  params: {
    context,  // Full ExecutionContext capsule
    mode: AgentTaskMode.PLAN,
    payload,
    userMessage: userInput,
    messages: conversationHistory,
  },
};

// Send request
const response = await axios.post(
  `/agent-to-agent/${context.orgSlug}/${context.agentSlug}/tasks`,
  request
);
```

## Back-End: Handling A2A Requests

```typescript
import {
  A2ATaskRequest,
  TaskResponse,
  A2ATaskSuccessResponse,
  A2ATaskErrorResponse,
  PlanCreatePayload,
} from '@orchestrator-ai/transport-types';

@Controller('agent-to-agent/:orgSlug/:agentSlug')
export class Agent2AgentController {
  @Post('tasks')
  async executeTask(
    @Body() body: A2ATaskRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
  ): Promise<A2ATaskSuccessResponse | A2ATaskErrorResponse> {
    // Validate JSON-RPC structure
    if (body.jsonrpc !== '2.0') {
      throw new BadRequestException('Invalid JSON-RPC version');
    }

    // Validate ExecutionContext
    if (!body.params.context) {
      throw new BadRequestException('ExecutionContext is required');
    }

    // Extract mode-specific payload
    const payload = body.params.payload as PlanCreatePayload;
    if (payload.action !== 'create') {
      throw new BadRequestException('Invalid action');
    }

    // Process request...
    const result = await this.handlePlanCreate(body.params.context, payload);

    // Build A2A response
    const response: A2ATaskSuccessResponse = {
      jsonrpc: '2.0',
      id: body.id,
      result: {
        success: true,
        mode: 'plan',
        payload: {
          content: result.content,
          metadata: result.metadata,
        },
        context: body.params.context,  // Return updated context
      },
    };

    return response;
  }
}
```

## Type Safety with Transport Types

```typescript
import {
  PlanCreatePayload,
  PlanReadPayload,
  PlanModePayload,
} from '@orchestrator-ai/transport-types';

// Type-safe payload handling
function handlePlanRequest(payload: PlanModePayload) {
  switch (payload.action) {
    case 'create':
      // TypeScript knows this is PlanCreatePayload
      const createPayload = payload as PlanCreatePayload;
      return handlePlanCreate(createPayload);
    
    case 'read':
      // TypeScript knows this is PlanReadPayload
      const readPayload = payload as PlanReadPayload;
      return handlePlanRead(readPayload);
    
    // ... other actions
  }
}
```

## Build Mode Example

```typescript
import {
  A2ATaskRequest,
  AgentTaskMode,
  BuildCreatePayload,
} from '@orchestrator-ai/transport-types';

const payload: BuildCreatePayload = {
  action: 'create',
  title: 'My Deliverable',
  type: 'blog-post',
  planVersionId: 'plan-version-id',
};

const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'build',
  id: context.taskId,
  params: {
    context,
    mode: AgentTaskMode.BUILD,
    payload,
    userMessage: 'Create a blog post about AI',
  },
};
```

## Converse Mode Example

```typescript
import {
  A2ATaskRequest,
  AgentTaskMode,
  ConverseModePayload,
} from '@orchestrator-ai/transport-types';

const payload: ConverseModePayload = {
  temperature: 0.7,
  maxTokens: 2000,
};

const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'converse',
  id: context.taskId,
  params: {
    context,
    mode: AgentTaskMode.CONVERSE,
    payload,
    userMessage: 'Hello, how are you?',
    messages: conversationHistory,
  },
};
```

## HITL Mode Example

```typescript
import {
  A2ATaskRequest,
  AgentTaskMode,
  HitlResumePayload,
} from '@orchestrator-ai/transport-types';

const payload: HitlResumePayload = {
  action: 'resume',
  taskId: 'task-id',
  decision: 'approve',
  feedback: 'Looks good!',
};

const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'hitl.resume',
  id: context.taskId,
  params: {
    context,
    mode: AgentTaskMode.HITL,
    payload,
    userMessage: '',
  },
};
```

## Error Handling

```typescript
import {
  A2ATaskErrorResponse,
  JsonRpcErrorCode,
  A2AErrorCode,
} from '@orchestrator-ai/transport-types';

// Handle errors with proper JSON-RPC format
function createErrorResponse(
  requestId: string | number | null,
  errorCode: number,
  message: string,
  data?: any,
): A2ATaskErrorResponse {
  return {
    jsonrpc: '2.0',
    id: requestId,
    error: {
      code: errorCode,
      message,
      data,
    },
  };
}

// Usage
if (!authorized) {
  return createErrorResponse(
    request.id,
    A2AErrorCode.UNAUTHORIZED,
    'User not authorized',
  );
}
```

## Validation at API Boundaries

```typescript
import {
  isA2ATaskRequest,
  isExecutionContext,
  isTaskResponse,
} from '@orchestrator-ai/transport-types';

@Post('tasks')
async executeTask(@Body() body: unknown): Promise<A2ATaskResponse> {
  // Validate JSON-RPC structure
  if (!isA2ATaskRequest(body)) {
    throw new BadRequestException('Invalid A2A request format');
  }

  // Validate ExecutionContext
  if (!isExecutionContext(body.params.context)) {
    throw new BadRequestException('Invalid ExecutionContext');
  }

  // Validate payload action
  const payload = body.params.payload;
  if (!payload || typeof payload.action !== 'string') {
    throw new BadRequestException('Payload action is required');
  }

  // Process request...
  const result = await this.processRequest(body);

  // Validate response structure
  if (!isTaskResponse(result)) {
    throw new InternalServerErrorException('Invalid response structure');
  }

  return {
    jsonrpc: '2.0',
    id: body.id,
    result,
  };
}
```

## External Agent Calls

```typescript
import {
  A2ATaskRequest,
  A2ATaskResponse,
} from '@orchestrator-ai/transport-types';

// Calling external A2A-compatible agent
async function callExternalAgent(
  agentUrl: string,
  context: ExecutionContext,
  payload: PlanCreatePayload,
): Promise<A2ATaskResponse> {
  const request: A2ATaskRequest = {
    jsonrpc: '2.0',
    method: 'plan',
    id: context.taskId,
    params: {
      context,
      mode: AgentTaskMode.PLAN,
      payload,
      userMessage: '',
    },
  };

  const response = await axios.post(`${agentUrl}/tasks`, request);
  return response.data;
}
```

