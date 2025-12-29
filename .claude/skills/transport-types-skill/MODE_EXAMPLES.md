# Transport Type Mode Examples

Examples for each A2A transport type mode: PLAN, BUILD, CONVERSE, HITL.

---

## Mode: PLAN

**Purpose:** Create or modify plans.

### Frontend Example

```typescript
import {
  A2ATaskRequest,
  AgentTaskMode,
  ExecutionContext,
  PlanCreatePayload,
} from '@orchestrator-ai/transport-types';
import { useExecutionContextStore } from '@/stores/executionContextStore';

const context = useExecutionContextStore().current;

// Build PLAN mode payload
const payload: PlanCreatePayload = {
  action: 'create',
  title: 'Build landing page',
  description: 'Create a new landing page for the product',
  phases: [
    { name: 'Design', steps: ['Create mockups', 'Get approval'] },
    { name: 'Development', steps: ['Build components', 'Add content'] }
  ]
};

// Build A2A request for PLAN mode
const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'plan', // Maps to AgentTaskMode.PLAN
  id: context.taskId,
  params: {
    context, // ✅ Full ExecutionContext
    mode: AgentTaskMode.PLAN,
    payload, // PlanCreatePayload
    userMessage: 'Create a plan for building a landing page',
    messages: [] // Conversation history
  }
};

// Send request
const response = await axios.post(
  `/agent-to-agent/${context.orgSlug}/${context.agentSlug}/tasks`,
  request
);
```

### Backend Example

```typescript
import {
  A2ATaskRequest,
  A2ATaskSuccessResponse,
  PlanCreatePayload,
  AgentTaskMode,
} from '@orchestrator-ai/transport-types';

@Controller('agent-to-agent/:orgSlug/:agentSlug')
export class Agent2AgentController {
  @Post('tasks')
  async executeTask(
    @Body() body: A2ATaskRequest,
  ): Promise<A2ATaskSuccessResponse> {
    // Validate mode
    if (body.params.mode !== AgentTaskMode.PLAN) {
      throw new BadRequestException('Invalid mode for this endpoint');
    }

    // Extract PLAN-specific payload
    const payload = body.params.payload as PlanCreatePayload;
    
    if (payload.action === 'create') {
      // Handle plan creation
      const plan = await this.planService.createPlan(
        body.params.context, // ✅ Pass whole context
        payload
      );

      // Build PLAN mode response
      return {
        jsonrpc: '2.0',
        id: body.id,
        result: {
          success: true,
          mode: 'plan',
          payload: {
            planId: plan.id,
            title: plan.title,
            phases: plan.phases
          },
          context: body.params.context, // ✅ Return context
        }
      };
    }
  }
}
```

---

## Mode: BUILD

**Purpose:** Execute build/implementation tasks.

### Frontend Example

```typescript
import {
  A2ATaskRequest,
  AgentTaskMode,
  ExecutionContext,
  BuildExecutePayload,
} from '@orchestrator-ai/transport-types';
import { useExecutionContextStore } from '@/stores/executionContextStore';

const context = useExecutionContextStore().current;

// Build BUILD mode payload
const payload: BuildExecutePayload = {
  action: 'execute',
  planId: 'plan-123',
  phaseId: 'phase-1',
  stepId: 'step-1',
  instructions: 'Build the user profile component'
};

// Build A2A request for BUILD mode
const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'build', // Maps to AgentTaskMode.BUILD
  id: context.taskId,
  params: {
    context, // ✅ Full ExecutionContext
    mode: AgentTaskMode.BUILD,
    payload, // BuildExecutePayload
    userMessage: 'Execute step 1 of phase 1',
    messages: []
  }
};

// Send request
const response = await axios.post(
  `/agent-to-agent/${context.orgSlug}/${context.agentSlug}/tasks`,
  request
);
```

### Backend Example

```typescript
import {
  A2ATaskRequest,
  A2ATaskSuccessResponse,
  BuildExecutePayload,
  AgentTaskMode,
} from '@orchestrator-ai/transport-types';

@Controller('agent-to-agent/:orgSlug/:agentSlug')
export class Agent2AgentController {
  @Post('tasks')
  async executeTask(
    @Body() body: A2ATaskRequest,
  ): Promise<A2ATaskSuccessResponse> {
    // Validate mode
    if (body.params.mode !== AgentTaskMode.BUILD) {
      throw new BadRequestException('Invalid mode');
    }

    // Extract BUILD-specific payload
    const payload = body.params.payload as BuildExecutePayload;
    
    if (payload.action === 'execute') {
      // Execute build step
      const result = await this.buildService.executeStep(
        body.params.context, // ✅ Pass whole context
        payload
      );

      // Build BUILD mode response
      return {
        jsonrpc: '2.0',
        id: body.id,
        result: {
          success: true,
          mode: 'build',
          payload: {
            stepId: result.stepId,
            status: result.status,
            output: result.output
          },
          context: body.params.context, // ✅ Return context
        }
      };
    }
  }
}
```

---

## Mode: CONVERSE

**Purpose:** Conversational agent interactions.

### Frontend Example

```typescript
import {
  A2ATaskRequest,
  AgentTaskMode,
  ExecutionContext,
  ConversePayload,
} from '@orchestrator-ai/transport-types';
import { useExecutionContextStore } from '@/stores/executionContextStore';

const context = useExecutionContextStore().current;

// Build CONVERSE mode payload
const payload: ConversePayload = {
  action: 'chat',
  message: 'What can you help me with?',
  conversationHistory: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi! How can I help?' }
  ]
};

// Build A2A request for CONVERSE mode
const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'converse', // Maps to AgentTaskMode.CONVERSE
  id: context.taskId,
  params: {
    context, // ✅ Full ExecutionContext
    mode: AgentTaskMode.CONVERSE,
    payload, // ConversePayload
    userMessage: payload.message,
    messages: payload.conversationHistory
  }
};

// Send request
const response = await axios.post(
  `/agent-to-agent/${context.orgSlug}/${context.agentSlug}/tasks`,
  request
);
```

### Backend Example

```typescript
import {
  A2ATaskRequest,
  A2ATaskSuccessResponse,
  ConversePayload,
  AgentTaskMode,
} from '@orchestrator-ai/transport-types';

@Controller('agent-to-agent/:orgSlug/:agentSlug')
export class Agent2AgentController {
  @Post('tasks')
  async executeTask(
    @Body() body: A2ATaskRequest,
  ): Promise<A2ATaskSuccessResponse> {
    // Validate mode
    if (body.params.mode !== AgentTaskMode.CONVERSE) {
      throw new BadRequestException('Invalid mode');
    }

    // Extract CONVERSE-specific payload
    const payload = body.params.payload as ConversePayload;
    
    if (payload.action === 'chat') {
      // Process conversation
      const response = await this.conversationService.chat(
        body.params.context, // ✅ Pass whole context
        payload.message,
        payload.conversationHistory
      );

      // Build CONVERSE mode response
      return {
        jsonrpc: '2.0',
        id: body.id,
        result: {
          success: true,
          mode: 'converse',
          payload: {
            message: response.message,
            conversationId: response.conversationId
          },
          context: body.params.context, // ✅ Return context
        }
      };
    }
  }
}
```

---

## Mode: HITL

**Purpose:** Human-in-the-loop interactions (approvals, reviews).

### Frontend Example

```typescript
import {
  A2ATaskRequest,
  AgentTaskMode,
  ExecutionContext,
  HITLPayload,
} from '@orchestrator-ai/transport-types';
import { useExecutionContextStore } from '@/stores/executionContextStore';

const context = useExecutionContextStore().current;

// Build HITL mode payload
const payload: HITLPayload = {
  action: 'request_approval',
  taskId: 'task-123',
  approvalType: 'content_review',
  content: 'Generated blog post content',
  metadata: {
    wordCount: 500,
    tone: 'professional'
  }
};

// Build A2A request for HITL mode
const request: A2ATaskRequest = {
  jsonrpc: '2.0',
  method: 'hitl', // Maps to AgentTaskMode.HITL
  id: context.taskId,
  params: {
    context, // ✅ Full ExecutionContext
    mode: AgentTaskMode.HITL,
    payload, // HITLPayload
    userMessage: 'Please review this content',
    messages: []
  }
};

// Send request
const response = await axios.post(
  `/agent-to-agent/${context.orgSlug}/${context.agentSlug}/tasks`,
  request
);
```

### Backend Example

```typescript
import {
  A2ATaskRequest,
  A2ATaskSuccessResponse,
  HITLPayload,
  AgentTaskMode,
} from '@orchestrator-ai/transport-types';

@Controller('agent-to-agent/:orgSlug/:agentSlug')
export class Agent2AgentController {
  @Post('tasks')
  async executeTask(
    @Body() body: A2ATaskRequest,
  ): Promise<A2ATaskSuccessResponse> {
    // Validate mode
    if (body.params.mode !== AgentTaskMode.HITL) {
      throw new BadRequestException('Invalid mode');
    }

    // Extract HITL-specific payload
    const payload = body.params.payload as HITLPayload;
    
    if (payload.action === 'request_approval') {
      // Create HITL task
      const hitlTask = await this.hitlService.createTask(
        body.params.context, // ✅ Pass whole context
        payload
      );

      // Build HITL mode response
      return {
        jsonrpc: '2.0',
        id: body.id,
        result: {
          success: true,
          mode: 'hitl',
          payload: {
            taskId: hitlTask.id,
            status: hitlTask.status,
            approvalType: hitlTask.approvalType
          },
          context: body.params.context, // ✅ Return context
        }
      };
    }
    
    if (payload.action === 'submit_approval') {
      // Process approval
      const result = await this.hitlService.processApproval(
        body.params.context, // ✅ Pass whole context
        payload.taskId,
        payload.approval
      );

      return {
        jsonrpc: '2.0',
        id: body.id,
        result: {
          success: true,
          mode: 'hitl',
          payload: {
            taskId: result.taskId,
            status: result.status,
            approved: result.approved
          },
          context: body.params.context, // ✅ Return context
        }
      };
    }
  }
}
```

---

## Mode Comparison

| Mode | Purpose | Payload Type | Use Case |
|------|---------|--------------|----------|
| **PLAN** | Create/modify plans | `PlanCreatePayload` | Planning workflows |
| **BUILD** | Execute build tasks | `BuildExecutePayload` | Implementation workflows |
| **CONVERSE** | Conversational chat | `ConversePayload` | Chat agents |
| **HITL** | Human approval | `HITLPayload` | Approval workflows |

---

## Key Principles

1. **Mode-Specific Payloads** - Each mode has its own payload type
2. **Context Always Included** - ExecutionContext in all requests/responses
3. **JSON-RPC 2.0** - All requests follow JSON-RPC format
4. **Method Mapping** - Method field maps to mode (plan, build, converse, hitl)
5. **Response Structure** - Responses include mode, payload, and context

---

## Related

- `SKILL.md` - Core transport types principles
- `PATTERNS.md` - General transport type patterns
- `DISCOVERY.md` - Agent discovery patterns
- `VIOLATIONS.md` - Common violations

