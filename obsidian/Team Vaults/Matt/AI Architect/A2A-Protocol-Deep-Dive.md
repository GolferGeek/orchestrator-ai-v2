# A2A Protocol Deep Dive: Complete Guide

**Date:** 2025-01-27  
**Purpose:** Complete technical understanding of A2A (Agent-to-Agent) protocol for AI Solutions Architect conversations

---

## Table of Contents

1. [What is A2A?](#what-is-a2a)
2. [A2A vs. MCP Comparison](#a2a-vs-mcp-comparison)
3. [Protocol Specification](#protocol-specification)
4. [Your Implementation](#your-implementation)
5. [Interview Questions & Answers](#interview-questions--answers)
6. [Code Examples](#code-examples)
7. [When to Use A2A vs. MCP](#when-to-use-a2a-vs-mcp)

---

## What is A2A?

### High-Level Overview

**A2A (Agent-to-Agent)** is a protocol for AI agents to communicate with each other. Think of it as the "language" that agents use to request work from other agents, share results, and coordinate complex workflows.

**Core Concept:**
- **Agents** are autonomous AI systems that can perform tasks
- **A2A Protocol** defines how agents request work, respond, and stream progress
- **JSON-RPC 2.0** is the underlying transport (standardized, well-supported)
- **Task-Based** - agents work on "tasks" with clear inputs/outputs

**Key Value Proposition:**
Instead of building N custom integrations for N agents, you build ONE A2A-compatible agent that can communicate with ANY other A2A-compatible agent.

### The Problem A2A Solves

**Before A2A:**
```
Agent A → Custom API for Agent B
       → Custom API for Agent C
       → Custom API for Agent D
       → (N custom integrations...)

Each integration = different format, different auth, different error handling
```

**With A2A:**
```
Agent A → A2A Client → Agent B (A2A-compatible)
                    → Agent C (A2A-compatible)
                    → Agent D (A2A-compatible)

One protocol = consistent interface for ALL agents
```

### Core Concepts

| Concept | What It Is | Analogy |
|---------|-----------|---------|
| **A2A Agent** | An AI system that exposes A2A endpoints | A service provider |
| **A2A Client** | Code that calls A2A agents | A customer |
| **Task** | A unit of work requested from an agent | An order |
| **JSON-RPC 2.0** | The underlying protocol | The language |
| **Task Modes** | Types of work (plan, build, converse) | Service categories |
| **Streaming** | Real-time progress updates | Live order tracking |

---

## A2A vs. MCP Comparison

### Key Differences

| Aspect | A2A (Agent-to-Agent) | MCP (Model Context Protocol) |
|--------|---------------------|------------------------------|
| **Purpose** | Agent-to-agent communication | LLM-to-tool communication |
| **Abstraction Level** | High (agent-level) | Low (tool-level) |
| **Communication** | Agent requests work from agent | LLM calls tools |
| **Protocol** | JSON-RPC 2.0 + A2A extensions | JSON-RPC 2.0 |
| **Response Format** | TaskResponse (structured) | Tool results (flexible) |
| **Streaming** | SSE for task progress | SSE for tool execution |
| **Use Case** | Multi-agent workflows | LLM function calling |

### When They Work Together

```
User Query
    ↓
Orchestrator Agent (A2A)
    ↓
Delegates to Specialist Agents (A2A)
    ↓
Specialist Agent uses Tools (MCP)
    ↓
Returns Results (A2A)
```

**Example:**
1. User asks orchestrator: "Create a marketing plan"
2. Orchestrator (A2A) delegates to marketing-agent
3. Marketing-agent (A2A) uses research tools (MCP)
4. Marketing-agent returns plan (A2A)
5. Orchestrator returns to user (A2A)

---

## Protocol Specification

### JSON-RPC 2.0 Foundation

A2A builds on JSON-RPC 2.0, a standardized remote procedure call protocol.

**Base Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "plan",
  "params": { ... },
  "id": "request-123"
}
```

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "result": { ... },
  "id": "request-123"
}
```

**Error Response:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": { ... }
  },
  "id": "request-123"
}
```

### A2A Extensions

A2A extends JSON-RPC with agent-specific structures:

**1. Task Modes (Methods)**
- `plan` - Create a plan
- `build` - Execute/build something
- `converse` - Conversational interaction
- `orchestrate` - Coordinate multiple agents

**2. TaskRequestParams Structure**
```typescript
interface TaskRequestParams {
  context: ExecutionContext;      // REQUIRED - org, user, conversation, task IDs
  mode: AgentTaskMode;            // REQUIRED - plan, build, converse, etc.
  payload: {                       // REQUIRED - action-specific data
    action: string;
    [key: string]: any;
  };
  userMessage: string;            // REQUIRED - user's request
  messages?: TaskMessage[];        // Optional - conversation history
  sessionId?: string;             // Optional - session grouping
  planId?: string;                // Optional - plan reference
  orchestrationId?: string;       // Optional - orchestration reference
}
```

**3. TaskResponse Structure**
```typescript
interface TaskResponse {
  success: boolean;               // REQUIRED - did it work?
  mode: string;                   // REQUIRED - which mode executed
  payload: {                       // REQUIRED - result data
    content: any;                 // The actual result
    metadata: Record<string, any>; // Usage stats, routing info, etc.
  };
  humanResponse?: {                // Optional - user-friendly message
    message: string;
  };
  error?: {                        // Optional - error details if failed
    message: string;
    code?: string;
  };
  context?: ExecutionContext;      // Optional - updated context
}
```

### ExecutionContext (The Context Capsule)

**What It Is:**
A complete context object that flows through the entire system. Contains everything needed for execution.

**Structure:**
```typescript
interface ExecutionContext {
  // Organization & User
  orgSlug: string;
  userId: string;
  
  // Conversation & Task
  conversationId?: string;
  taskId?: string;
  
  // LLM Configuration
  provider: string;                // 'openai', 'anthropic', 'google', etc.
  model: string;                  // 'gpt-5', 'claude-3-opus', etc.
  
  // Agent Info
  agentSlug: string;
  
  // Additional metadata
  [key: string]: any;
}
```

**Key Principle:** Context travels whole, never cherry-picked. This ensures consistency across the system.

---

## Your Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator AI                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Web Frontend  │    │         NestJS API              │ │
│  │                 │    │                                 │ │
│  │  A2A Orchestrator│───→│  Agent2Agent Controller        │ │
│  │  (Client)       │    │  (A2A Endpoints)                │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│           ↓                            ↓                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Agent Runners                             │  │
│  │                                                        │  │
│  │  • Context Agent Runner                               │  │
│  │  • Orchestrator Agent Runner (delegates via A2A)     │  │
│  │  • External Agent Runner (calls external A2A agents)│  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         External A2A Agents                            │  │
│  │  (Other systems exposing A2A endpoints)                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Transport Types (`apps/transport-types`)

**Purpose:** Shared TypeScript types ensuring API and Web use identical protocol structures.

**Key Files:**
- `request/json-rpc.types.ts` - JSON-RPC 2.0 base types
- `request/task-request.types.ts` - A2A request structures
- `response/task-response.types.ts` - A2A response structures
- `streaming/sse-events.types.ts` - SSE event types
- `core/execution-context.ts` - ExecutionContext definition

**Usage Rule:** Always import from `@orchestrator-ai/transport-types`. Never create custom shapes.

#### 2. API Endpoints (`apps/api/src/agent2agent/`)

**Main Endpoint:**
```
POST /agent-to-agent/:orgSlug/:agentSlug/tasks
```

**Request Format:**
```json
{
  "jsonrpc": "2.0",
  "method": "build",
  "params": {
    "context": { ... },
    "mode": "build",
    "payload": {
      "action": "create",
      "content": "Write a blog post about AI"
    },
    "userMessage": "Write a blog post about AI"
  },
  "id": "task-123"
}
```

**Response Format:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "mode": "build",
    "payload": {
      "content": { ... },
      "metadata": { ... }
    },
    "context": { ... }
  },
  "id": "task-123"
}
```

#### 3. Streaming (SSE)

**Endpoint:**
```
GET /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream
```

**Events:**
- `agent_stream_chunk` - Incremental content updates
- `agent_stream_complete` - Task completed
- `agent_stream_error` - Error occurred
- `task_progress` - Progress updates

**Event Format:**
```
event: agent_stream_chunk
data: {"event":"agent_stream_chunk","data":{"chunk":{"type":"partial","content":"..."},"context":{...}}}

event: agent_stream_complete
data: {"event":"agent_stream_complete","data":{"type":"complete","context":{...}}}
```

#### 4. Agent Discovery (`.well-known/agent.json`)

**Endpoint:**
```
GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json
```

**Purpose:** Machine-readable metadata describing agent capabilities.

**Response:**
```json
{
  "name": "Blog Post Writer",
  "description": "Creates blog posts",
  "modes": ["build", "converse"],
  "capabilities": {
    "build": {
      "actions": ["create", "update", "delete"]
    }
  },
  "configuration": {
    "tools": ["supabase/execute-sql", "slack/send-message"]
  }
}
```

### Implementation Patterns

#### Pattern 1: Direct Agent Call

```typescript
// Frontend calls agent directly
const response = await a2aOrchestrator.execute('build', {
  payload: {
    action: 'create',
    content: 'Write a blog post'
  },
  userMessage: 'Write a blog post about AI'
});
```

#### Pattern 2: Agent Delegation (Orchestrator)

```typescript
// Orchestrator agent delegates to specialist
class OrchestratorAgentRunner {
  async executeBuild(request: TaskRequestDto) {
    // 1. Select best sub-agent
    const targetAgent = await this.selectSubAgent(request);
    
    // 2. Delegate via A2A
    const response = await this.delegateToSubAgent(
      targetAgent,
      request
    );
    
    // 3. Return with attribution
    return this.addAttribution(response, targetAgent);
  }
}
```

#### Pattern 3: External Agent Call

```typescript
// Call external A2A-compatible agent
class ExternalAgentRunner {
  async execute(request: TaskRequestDto) {
    // Build A2A request
    const a2aRequest: TaskRequestDto = {
      ...request,
      context: request.context // Forward context unchanged
    };
    
    // Call external endpoint
    const response = await httpService.post(
      `${externalAgentUrl}/agent-to-agent/${orgSlug}/${agentSlug}/tasks`,
      {
        jsonrpc: '2.0',
        method: request.mode,
        params: a2aRequest,
        id: generateId()
      }
    );
    
    // Parse A2A response
    return response.data.result as TaskResponse;
  }
}
```

---

## Interview Questions & Answers

### High-Level Questions

**Q: What is A2A and why does it matter?**
**A:** 
A2A (Agent-to-Agent) is a protocol that enables AI agents to communicate with each other in a standardized way. It matters because:

1. **Interoperability:** Any A2A-compatible agent can work with any other A2A-compatible agent
2. **Composability:** Build complex workflows by composing multiple agents
3. **Standardization:** One protocol instead of N custom integrations
4. **Ecosystem:** As more agents adopt A2A, the ecosystem becomes more powerful

**Q: How does A2A differ from regular API calls?**
**A:**
**Regular APIs:**
- Custom format per service
- Different auth mechanisms
- Inconsistent error handling
- No standard task model

**A2A:**
- Standardized JSON-RPC 2.0 format
- Consistent request/response structure
- Standardized error codes
- Task-based model (plan, build, converse)
- Built-in streaming support
- Agent discovery via `.well-known/agent.json`

**Q: What problem does A2A solve that MCP doesn't?**
**A:**
**MCP solves:** LLM-to-tool communication (low-level)
**A2A solves:** Agent-to-agent communication (high-level)

**Key Difference:**
- **MCP:** "Call this tool" (function-level)
- **A2A:** "Do this task" (agent-level)

**Example:**
- **MCP:** "Call supabase/execute-sql with this query"
- **A2A:** "Marketing agent, create a campaign plan" (agent handles tool selection internally)

### Mid-Level Technical Questions

**Q: How does the ExecutionContext work in A2A?**
**A:**
**Purpose:** ExecutionContext is a "context capsule" that contains all execution-related data.

**Key Principle:** Context travels whole, never cherry-picked. This ensures:
- Consistency across the system
- No context loss between calls
- Single source of truth

**Contents:**
- Organization & user identifiers
- Conversation & task IDs
- LLM provider/model configuration
- Agent information
- Custom metadata

**Flow:**
```
Frontend → Builds context → API → Agent → Updates context → Returns → Frontend updates store
```

**Q: How does A2A handle streaming?**
**A:**
**Mechanism:** Server-Sent Events (SSE) over HTTP

**Process:**
1. Client requests task execution
2. Server creates task, returns taskId
3. Client requests stream token (JWT-protected)
4. Client connects to SSE endpoint with token
5. Server streams events:
   - `agent_stream_chunk` - Incremental content
   - `agent_stream_complete` - Task done
   - `agent_stream_error` - Error occurred
   - `task_progress` - Progress updates

**Event Structure:**
```typescript
{
  event: "agent_stream_chunk",
  data: {
    chunk: {
      type: "partial" | "final" | "progress",
      content: "...",
      metadata: { ... }
    },
    context: ExecutionContext,  // Full context capsule
    userMessage: "...",
    timestamp: "2025-01-27T..."
  }
}
```

**Q: What are task modes and when do you use each?**
**A:**
**Task Modes:**
1. **`plan`** - Create a plan or strategy
   - Use when: Need structured planning
   - Returns: Plan object with steps
   - Example: "Create a marketing campaign plan"

2. **`build`** - Execute/build something
   - Use when: Need to create deliverables
   - Returns: Built content (code, documents, etc.)
   - Example: "Write a blog post"

3. **`converse`** - Conversational interaction
   - Use when: Need back-and-forth dialogue
   - Returns: Conversational response
   - Example: "Answer questions about our product"

4. **`orchestrate`** - Coordinate multiple agents
   - Use when: Need to delegate to multiple agents
   - Returns: Aggregated results
   - Example: "Create a complete marketing campaign" (delegates to writer, designer, analyst)

**Q: How does agent discovery work?**
**A:**
**Endpoint:** `GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json`

**Purpose:** Machine-readable metadata about agent capabilities

**Response Includes:**
- Agent name and description
- Supported modes
- Available actions per mode
- Required/optional parameters
- Tool capabilities
- Visibility settings

**Use Cases:**
- **Orchestrator agents:** Discover available agents to delegate to
- **Tool selection:** Understand what an agent can do
- **Workflow planning:** Determine if agent supports needed capabilities
- **Integration:** Understand how to call the agent

**Q: How do you handle errors in A2A?**
**A:**
**Error Response Format:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "details": "...",
      "taskId": "...",
      "context": { ... }
    }
  },
  "id": "request-123"
}
```

**Error Codes (JSON-RPC Standard):**
- `-32700` - Parse error
- `-32600` - Invalid Request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error
- `-32000` to `-32099` - Server error (custom)

**Error Handling Strategy:**
1. **Validate early** - Check request format at controller
2. **Fail fast** - Return errors immediately
3. **Include context** - Error data includes ExecutionContext
4. **Stream errors** - SSE can emit error events mid-stream
5. **Retry logic** - Client handles retries with exponential backoff

### Customer-Facing Questions

**Q: Why should we use A2A instead of building custom integrations?**
**A:**
**Benefits:**
1. **Faster integration:** Standard protocol = less custom code
2. **Future-proof:** As ecosystem grows, more agents become available
3. **Maintainability:** One protocol to maintain vs. N custom integrations
4. **Composability:** Easily combine multiple agents into workflows
5. **Discovery:** Agents can discover each other automatically

**Cost Comparison:**
- **Custom integration:** 2-4 weeks per agent
- **A2A integration:** 1-2 days per agent (if A2A-compatible)

**Q: How does A2A ensure security?**
**A:**
**Security Layers:**
1. **Authentication:** JWT tokens required for task execution
2. **Authorization:** RBAC controls who can call which agents
3. **Context Isolation:** Each organization's context is isolated
4. **Stream Tokens:** SSE requires scoped JWT tokens
5. **Validation:** Early validation prevents malformed requests
6. **Audit Logging:** All A2A calls are logged with full context

**Q: Can we use A2A with our existing systems?**
**A:**
**Yes, in two ways:**

1. **Make your systems A2A-compatible:**
   - Implement A2A endpoints
   - Expose `.well-known/agent.json`
   - Use JSON-RPC 2.0 format

2. **Use A2A agents that integrate with your systems:**
   - Agents can call your APIs via MCP tools
   - Agents can access your databases
   - Agents can trigger your workflows

**Migration Path:**
- Start with A2A-compatible agents
- Gradually expose your systems as A2A agents
- Build hybrid workflows (A2A + direct APIs)

---

## Code Examples

### Example 1: Basic A2A Call (Frontend)

```typescript
// apps/web/src/services/agent2agent/orchestrator/a2a-orchestrator.ts

import { useExecutionContextStore } from '@/stores/execution-context';

class A2AOrchestrator {
  async execute(trigger: A2ATrigger, payload: A2APayload = {}): Promise<A2AResult> {
    // 1. Get context from store
    const executionContextStore = useExecutionContextStore();
    const ctx = executionContextStore.current;

    // 2. Build A2A request
    const request = {
      jsonrpc: '2.0',
      method: 'build',
      params: {
        context: ctx,
        mode: 'build',
        payload: {
          action: 'create',
          ...payload
        },
        userMessage: payload.userMessage || ''
      },
      id: generateId()
    };

    // 3. Send to API
    const response = await fetch(
      `${API_BASE_URL}/agent-to-agent/${ctx.orgSlug}/${ctx.agentSlug}/tasks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request)
      }
    );

    // 4. Parse response
    const data = await response.json();
    
    if (data.error) {
      return {
        type: 'error',
        error: data.error.message
      };
    }

    // 5. Update context store with returned context
    if (data.result.context) {
      executionContextStore.update(data.result.context);
    }

    return {
      type: 'success',
      result: data.result
    };
  }
}
```

### Example 2: Streaming Task Execution

```typescript
// Frontend: Connect to SSE stream
async function streamTask(taskId: string) {
  // 1. Get stream token
  const tokenResponse = await fetch(
    `${API_BASE_URL}/agent-to-agent/${orgSlug}/${agentSlug}/tasks/${taskId}/stream-token`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}` }
    }
  );
  const { token } = await tokenResponse.json();

  // 2. Connect to SSE stream
  const eventSource = new EventSource(
    `${API_BASE_URL}/agent-to-agent/${orgSlug}/${agentSlug}/tasks/${taskId}/stream?token=${token}`
  );

  // 3. Handle events
  eventSource.addEventListener('agent_stream_chunk', (event) => {
    const data = JSON.parse(event.data);
    console.log('Chunk:', data.data.chunk.content);
    // Update UI with incremental content
  });

  eventSource.addEventListener('agent_stream_complete', (event) => {
    const data = JSON.parse(event.data);
    console.log('Complete:', data.data);
    eventSource.close();
  });

  eventSource.addEventListener('agent_stream_error', (event) => {
    const data = JSON.parse(event.data);
    console.error('Error:', data.data.error);
    eventSource.close();
  });
}
```

### Example 3: Agent Delegation (Orchestrator)

```typescript
// apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts

@Injectable()
export class OrchestratorAgentRunnerService {
  async executeBuild(request: TaskRequestDto): Promise<TaskResponseDto> {
    // 1. Select best sub-agent using LLM
    const targetAgent = await this.selectSubAgent(request);
    
    // 2. Delegate via A2A endpoint
    const response = await this.delegateToSubAgent(targetAgent, request);
    
    // 3. Add attribution metadata
    return this.addAttribution(response, targetAgent);
  }

  private async delegateToSubAgent(
    targetAgent: string,
    request: TaskRequestDto
  ): Promise<TaskResponseDto> {
    const baseUrl = process.env.API_BASE_URL;
    const orgPath = request.context.orgSlug;
    
    // Build A2A request (forward context unchanged)
    const a2aRequest: TaskRequestDto = {
      ...request,
      context: request.context  // Forward context whole
    };

    // Call sub-agent via A2A endpoint
    const response = await this.httpService.post(
      `${baseUrl}/agent-to-agent/${orgPath}/${targetAgent}/tasks`,
      {
        jsonrpc: '2.0',
        method: request.mode,
        params: a2aRequest,
        id: generateId()
      }
    ).toPromise();

    // Parse A2A response
    return response.data.result as TaskResponseDto;
  }
}
```

### Example 4: External Agent Call

```typescript
// apps/api/src/agent2agent/services/external-agent-runner.service.ts

@Injectable()
export class ExternalAgentRunnerService {
  async execute(request: TaskRequestDto): Promise<TaskResponseDto> {
    const externalAgent = request.context.externalAgent;
    
    // 1. Build A2A request
    const a2aRequest: TaskRequestDto = {
      ...request,
      context: request.context  // Forward context unchanged
    };

    // 2. Call external A2A endpoint
    const response = await this.httpService.post(
      `${externalAgent.url}/agent-to-agent/${orgSlug}/${agentSlug}/tasks`,
      {
        jsonrpc: '2.0',
        method: request.mode,
        params: a2aRequest,
        id: generateId()
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Orchestrator-AI-A2A/1.0',
          ...(externalAgent.authHeader ? { 'Authorization': externalAgent.authHeader } : {})
        }
      }
    ).toPromise();

    // 3. Validate A2A response format
    if (!response.data.result || typeof response.data.result.success !== 'boolean') {
      throw new Error('Invalid A2A response format');
    }

    // 4. Return response
    return response.data.result as TaskResponseDto;
  }
}
```

### Example 5: Agent Discovery

```typescript
// Discover agent capabilities
async function discoverAgent(orgSlug: string, agentSlug: string) {
  const response = await fetch(
    `${API_BASE_URL}/agent-to-agent/${orgSlug}/${agentSlug}/.well-known/agent.json`
  );
  
  const agentCard = await response.json();
  
  console.log('Agent:', agentCard.name);
  console.log('Modes:', agentCard.modes);
  console.log('Capabilities:', agentCard.capabilities);
  
  // Use capabilities to determine if agent can handle request
  if (agentCard.modes.includes('build')) {
    // Agent can build things
  }
}
```

---

## When to Use A2A vs. MCP

### Use A2A When:

| Scenario | Why A2A |
|----------|---------|
| **Agent-to-agent communication** | A2A is designed for this |
| **Multi-agent workflows** | Standardized agent communication |
| **Agent discovery** | `.well-known/agent.json` enables discovery |
| **Task-based work** | A2A's task model fits naturally |
| **Agent orchestration** | Orchestrators delegate via A2A |
| **External agent integration** | Standard protocol for third-party agents |

### Use MCP When:

| Scenario | Why MCP |
|----------|---------|
| **LLM-to-tool communication** | MCP is designed for this |
| **Function calling** | Tools are functions, not agents |
| **Tool discovery** | `tools/list` provides tool catalog |
| **Resource access** | MCP's resource capability |
| **Prompt templates** | MCP's prompts capability |
| **Third-party integrations** | Slack, Notion, etc. via MCP servers |

### Use Both Together:

**Recommended Architecture:**
```
User Query
    ↓
Orchestrator Agent (A2A)
    ↓
Delegates to Specialist Agent (A2A)
    ↓
Specialist Agent uses Tools (MCP)
    ↓
Returns Results (A2A)
```

**Example Implementation:**
```typescript
// Orchestrator uses A2A to delegate
const response = await a2aClient.call('marketing-agent', {
  mode: 'build',
  payload: { action: 'create', content: 'campaign plan' }
});

// Marketing agent internally uses MCP tools
const tools = await mcpClient.listTools();  // MCP
const result = await mcpClient.callTool('slack/send-message', {...});  // MCP

// Marketing agent returns via A2A
return {
  success: true,
  payload: { content: result, metadata: {...} }
};  // A2A
```

---

## Key Architectural Decisions

### Decision 1: JSON-RPC 2.0 as Base

**Why:**
- Standardized, well-supported protocol
- Clear request/response structure
- Built-in error handling
- Language-agnostic

**Trade-offs:**
- ✅ Standardized
- ✅ Well-documented
- ✅ Tool support
- ⚠️ Requires A2A extensions for agent-specific needs

### Decision 2: ExecutionContext Capsule

**Why:**
- Single source of truth for context
- Prevents context loss
- Ensures consistency
- Simplifies debugging

**Trade-offs:**
- ✅ Consistency
- ✅ No context loss
- ✅ Easier debugging
- ⚠️ Larger payload size

### Decision 3: Task-Based Model

**Why:**
- Clear input/output contracts
- Supports different work types (modes)
- Enables composition
- Standardized responses

**Trade-offs:**
- ✅ Clear contracts
- ✅ Flexible modes
- ✅ Composable
- ⚠️ May be overkill for simple calls

### Decision 4: SSE for Streaming

**Why:**
- Real-time progress updates
- Standard HTTP protocol
- Browser-native support
- Simpler than WebSockets for one-way

**Trade-offs:**
- ✅ Real-time updates
- ✅ Standard protocol
- ✅ Browser support
- ⚠️ One-way only (server → client)

---

## References

- **JSON-RPC 2.0 Spec:** https://www.jsonrpc.org/specification
- **Your Implementation:** `apps/api/src/agent2agent/`
- **Transport Types:** `apps/transport-types/`
- **A2A Protocol Doc:** `obsidian/efforts/Matt/agent-roles/agent-expertise/agent2agent-protocol.md`

---

**See Also:**
- [MCP-Architecture-Deep-Dive.md](./MCP-Architecture-Deep-Dive.md) - MCP protocol details
- [MCP-vs-A2A-Comparison.md](./MCP-vs-A2A-Comparison.md) - Decision framework

