# LangGraph Workflow Engine

TypeScript-based LangGraph workflow execution engine for Orchestrator AI. Provides HTTP endpoints for complex multi-step AI workflows with real-time progress streaming.

## Overview

This NestJS application serves as a dedicated workflow execution engine, running independently from the main API. It exposes three workflow endpoints that can be called directly or wrapped as API agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    apps/langgraph/                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │         LangGraph Workflow Endpoints               │   │
│  │  POST /workflows/marketing-swarm                   │   │
│  │  POST /workflows/requirements-writer               │   │
│  │  POST /workflows/metrics-agent                     │   │
│  └────────────────┬───────────────────────────────────┘   │
│                   │                                         │
│  ┌────────────────▼───────────────────────────────────┐   │
│  │      Workflow Execution Engine                     │   │
│  │  - Sequential LLM call orchestration               │   │
│  │  - Webhook progress streaming                      │   │
│  │  - Error handling & retries                        │   │
│  └────────┬──────────────────────┬────────────────────┘   │
│           │                      │                         │
│  ┌────────▼──────────┐  ┌────────▼──────────────────┐    │
│  │  LLM HTTP Client  │  │  Webhook Status Service   │    │
│  │  Service          │  │  - Send progress updates  │    │
│  └────────┬──────────┘  └───────────────────────────┘    │
└───────────┼─────────────────────────────────────────────┘
            │
            │ HTTP POST /llm/generate
            ▼
┌─────────────────────────────────────────────────────────────┐
│              apps/api (Port 6100)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LLM Service: POST /llm/generate                     │  │
│  │  Webhook Service: POST /webhooks/status              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. Marketing Swarm (3 steps)
**Endpoint:** `POST /workflows/marketing-swarm`

Generates comprehensive marketing content for product announcements:
1. **Web Post** - Engaging blog post for all audiences
2. **SEO Content** - Meta tags, keywords, structured data
3. **Social Media** - Platform-specific posts (Twitter, LinkedIn, Facebook)

**Use Case:** Launch announcements, feature releases, company news

### 2. Requirements Writer (6 steps)
**Endpoint:** `POST /workflows/requirements-writer`

Transforms ideas into professional requirements documents:
1. **Analyze Request** - Understand intent, scope, and domain
2. **Determine Document Type** - Auto-select PRD, TRD, API, User Story, or Architecture doc
3. **Extract Features** - Identify key components and capabilities
4. **Assess Complexity** - Evaluate effort, team size, and risks
5. **Generate Document** - Create comprehensive requirements
6. **Finalize Response** - Package with metadata

**Use Case:** Feature planning, system design, API specifications

### 3. Metrics Agent (2 steps)
**Endpoint:** `POST /workflows/metrics-agent`

Analyzes business metrics and generates insights:
1. **Parse Query** - Identify metrics type and data sources
2. **Generate Report** - Create markdown report with SQL queries

**Use Case:** Revenue analysis, KPI tracking, operational metrics

## Installation

```bash
cd apps/langgraph
npm install
```

## Configuration

Create `.env` file:

```env
# LangGraph Application
LANGGRAPH_PORT=7200
LANGGRAPH_HOST=0.0.0.0

# LLM Service Integration
LLM_SERVICE_URL=http://localhost:6100
LLM_ENDPOINT=/llm/generate

# Webhook Configuration
WEBHOOK_STATUS_URL=http://localhost:6100/webhooks/status

# Optional
NODE_ENV=development
LOG_LEVEL=debug
```

## Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Health Check
```bash
curl http://localhost:7200/health
```

## API Request Format

All workflows use the **ExecutionContext capsule pattern** for requests. Instead of passing individual fields, workflows receive a complete `ExecutionContext` object that contains all execution metadata.

### Standard Request (WorkflowRequestDto)

```typescript
{
  "context": {
    "orgSlug": "acme-corp",                            // Organization identifier
    "userId": "550e8400-e29b-41d4-a716-446655440000",  // User ID (from auth)
    "conversationId": "550e8400-e29b-41d4-a716-446655440001", // Conversation ID
    "taskId": "550e8400-e29b-41d4-a716-446655440002",  // Task ID
    "planId": "00000000-0000-0000-0000-000000000000",  // Plan ID (NIL_UUID if none)
    "deliverableId": "00000000-0000-0000-0000-000000000000", // Deliverable ID (NIL_UUID if none)
    "agentSlug": "data-analyst",                       // Agent identifier
    "agentType": "langgraph",                          // Agent type
    "provider": "anthropic",                           // LLM provider
    "model": "claude-opus-4-5"                         // LLM model
  },
  "prompt": "string",         // Required: User request/message
  "statusWebhook": "url",     // Optional: Webhook URL for progress updates
  "metadata": {}              // Optional: Additional context
}
```

### Agent-Specific Requests

Some agents require additional structured inputs beyond the standard `prompt` field. For example, Extended Post Writer:

```typescript
{
  "context": { /* ExecutionContext */ },
  "userMessage": "Write about cloud computing",  // Main content request
  "contextInfo": "Target audience: developers",  // Additional context
  "keywords": ["cloud", "serverless", "API"],    // SEO keywords
  "tone": "professional"                         // Content tone
}
```

### ExecutionContext Capsule Pattern

**Key Principles:**
- **Created on front-end**: ExecutionContext is generated when conversation is selected
- **Received by backend**: Backend validates and potentially enriches it (adds planId, deliverableId)
- **Passed whole**: Always pass the entire capsule, never cherry-pick individual fields
- **Never constructed in backend**: LangGraph workflows receive ExecutionContext, never create it
- **Flows through system**: Used for LLM calls, observability events, and workflow state

## Response Format

All workflows return a standardized response with ExecutionContext:

```typescript
{
  "success": true,
  "taskId": "uuid",           // Deprecated: Use context.taskId (kept for backward compatibility)
  "conversationId": "uuid",   // Deprecated: Use context.conversationId (kept for backward compatibility)
  "data": {
    // Workflow-specific results
  },
  "metadata": {
    "executionTime": 45000,   // Milliseconds
    "stepsCompleted": 3,
    "provider": "anthropic",
    "model": "claude-opus-4-5"
  },
  "context": {
    // Complete ExecutionContext capsule (potentially updated by backend)
    "orgSlug": "acme-corp",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "conversationId": "550e8400-e29b-41d4-a716-446655440001",
    "taskId": "550e8400-e29b-41d4-a716-446655440002",
    "planId": "550e8400-e29b-41d4-a716-446655440003",  // May be added by backend
    "deliverableId": "550e8400-e29b-41d4-a716-446655440004", // May be added by backend
    "agentSlug": "data-analyst",
    "agentType": "langgraph",
    "provider": "anthropic",
    "model": "claude-opus-4-5"
  }
}
```

**Context Continuity**: The response includes the ExecutionContext capsule, potentially updated by the backend (e.g., with newly created `planId` or `deliverableId`). Front-end should update its store with the returned context to maintain continuity.

## Webhook Streaming

When `statusWebhook` is provided, the workflow sends progress updates via the ObservabilityService. All events include the complete ExecutionContext capsule.

### Started
```json
{
  "context": {
    "orgSlug": "acme-corp",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "conversationId": "550e8400-e29b-41d4-a716-446655440001",
    "taskId": "550e8400-e29b-41d4-a716-446655440002",
    "planId": "00000000-0000-0000-0000-000000000000",
    "deliverableId": "00000000-0000-0000-0000-000000000000",
    "agentSlug": "data-analyst",
    "agentType": "langgraph",
    "provider": "anthropic",
    "model": "claude-opus-4-5"
  },
  "taskId": "550e8400-e29b-41d4-a716-446655440002",  // Duplicated for routing
  "status": "langgraph.started",
  "timestamp": "2025-01-04T12:00:00Z",
  "message": "Workflow execution started",
  "mode": "build",
  "data": {
    "hook_event_type": "langgraph.started",
    "source_app": "langgraph",
    "threadId": "550e8400-e29b-41d4-a716-446655440002"
  }
}
```

### Processing
```json
{
  "context": { /* ExecutionContext */ },
  "taskId": "uuid",
  "status": "langgraph.processing",
  "timestamp": "2025-01-04T12:00:15Z",
  "step": "analyze_data",
  "percent": 50,
  "message": "Analyzing data",
  "mode": "build",
  "data": {
    "hook_event_type": "langgraph.processing",
    "source_app": "langgraph",
    "threadId": "uuid"
  }
}
```

### HITL Waiting (Human-in-the-Loop)
```json
{
  "context": { /* ExecutionContext */ },
  "taskId": "uuid",
  "status": "langgraph.hitl_waiting",
  "timestamp": "2025-01-04T12:00:30Z",
  "message": "Awaiting human review",
  "mode": "build",
  "data": {
    "hook_event_type": "langgraph.hitl_waiting",
    "source_app": "langgraph",
    "threadId": "uuid",
    "pendingContent": { /* Content awaiting approval */ }
  }
}
```

### Completed
```json
{
  "context": { /* ExecutionContext */ },
  "taskId": "uuid",
  "status": "langgraph.completed",
  "timestamp": "2025-01-04T12:01:30Z",
  "message": "Workflow completed successfully",
  "mode": "build",
  "data": {
    "hook_event_type": "langgraph.completed",
    "source_app": "langgraph",
    "threadId": "uuid",
    "result": { /* Final workflow results */ },
    "duration": 90000
  }
}
```

### Failed
```json
{
  "context": { /* ExecutionContext */ },
  "taskId": "uuid",
  "status": "langgraph.failed",
  "timestamp": "2025-01-04T12:00:45Z",
  "message": "Workflow failed: Error message",
  "mode": "build",
  "data": {
    "hook_event_type": "langgraph.failed",
    "source_app": "langgraph",
    "threadId": "uuid",
    "error": "Error message"
  }
}
```

**Event Types**: `langgraph.started`, `langgraph.processing`, `langgraph.hitl_waiting`, `langgraph.hitl_resumed`, `langgraph.completed`, `langgraph.failed`, `langgraph.tool_calling`, `langgraph.tool_completed`

## API Agent Integration

Three API agents have been created in the database to wrap these workflows:

1. **marketing-swarm-langgraph** - Marketing content generation
2. **requirements-writer-langgraph** - Requirements documentation
3. **metrics-agent-langgraph** - Business metrics analysis

These can be invoked through the Orchestrator AI A2A protocol:

```bash
curl -X POST http://localhost:6100/a2a/agents/marketing/marketing-swarm-langgraph/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "method": "process",
    "prompt": "Announce the launch of our new AI-powered analytics platform"
  }'
```

## Example: Marketing Swarm

```bash
curl -X POST http://localhost:7200/workflows/marketing-swarm \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "orgSlug": "acme-corp",
      "userId": "123e4567-e89b-12d3-a456-426614174002",
      "conversationId": "123e4567-e89b-12d3-a456-426614174001",
      "taskId": "123e4567-e89b-12d3-a456-426614174000",
      "planId": "00000000-0000-0000-0000-000000000000",
      "deliverableId": "00000000-0000-0000-0000-000000000000",
      "agentSlug": "marketing-swarm",
      "agentType": "langgraph",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514"
    },
    "prompt": "Announce the launch of our new AI-powered analytics platform",
    "statusWebhook": "http://localhost:6100/webhooks/status"
  }'
```

**Response:**
```json
{
  "success": true,
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "conversationId": "123e4567-e89b-12d3-a456-426614174001",
  "data": {
    "webPost": "# Introducing Our Revolutionary AI-Powered Analytics Platform\n\n...",
    "seoContent": "Meta Title: AI-Powered Analytics Platform Launch...",
    "socialMedia": "🚀 Twitter: Excited to announce..."
  },
  "metadata": {
    "executionTime": 45231,
    "stepsCompleted": 3,
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "context": {
    "orgSlug": "acme-corp",
    "userId": "123e4567-e89b-12d3-a456-426614174002",
    "conversationId": "123e4567-e89b-12d3-a456-426614174001",
    "taskId": "123e4567-e89b-12d3-a456-426614174000",
    "planId": "00000000-0000-0000-0000-000000000000",
    "deliverableId": "00000000-0000-0000-0000-000000000000",
    "agentSlug": "marketing-swarm",
    "agentType": "langgraph",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

## ExecutionContext Flow

ExecutionContext is the foundation of observability and context continuity in LangGraph workflows. Understanding how it flows through the system is critical for building reliable workflows.

### Front-End Creation

ExecutionContext is **created on the front-end** when a conversation is selected:

```typescript
// Front-end: Initialize ExecutionContext
executionContextStore.initialize({
  orgSlug: currentOrg.slug,
  userId: currentUser.id,
  conversationId: uuidv4(),  // Generated on front-end
  taskId: uuidv4(),          // Generated on front-end
  planId: NIL_UUID,          // Backend may populate this later
  deliverableId: NIL_UUID,   // Backend may populate this later
  agentSlug: selectedAgent.slug,
  agentType: selectedAgent.type,
  provider: llmSettings.provider,
  model: llmSettings.model
});
```

### Backend Reception

Backend **receives** ExecutionContext from API requests and validates it:

```typescript
// Controller: Receive and validate ExecutionContext
@Post('execute')
async execute(@Body() dto: WorkflowRequestDto) {
  // dto.context is already validated by @IsValidExecutionContext() decorator

  // Backend validates userId matches authenticated user
  if (dto.context.userId !== req.user.id) {
    throw new UnauthorizedException('User ID mismatch');
  }

  // Backend may enrich ExecutionContext (e.g., add planId)
  const enrichedContext = await this.enrichContext(dto.context);

  // Pass full capsule to service
  return await this.service.execute(enrichedContext, dto.prompt);
}
```

### LangGraph State

ExecutionContext flows through LangGraph workflows via state annotations:

```typescript
// State: Store ExecutionContext in workflow state
export const MyWorkflowStateAnnotation = Annotation.Root({
  ...HitlBaseStateAnnotation.spec,  // Includes executionContext field

  // Workflow-specific fields
  result: Annotation<unknown>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

// Graph invocation: Pass ExecutionContext to initial state
const result = await graph.invoke(
  {
    executionContext: dto.context,  // Full capsule
    userMessage: dto.prompt,
  },
  {
    configurable: {
      thread_id: dto.context.taskId,  // Use taskId as thread ID for checkpointing
    },
  }
);
```

### Service Integration

ExecutionContext is **always passed whole** to services:

```typescript
// LLM Service: Receives full ExecutionContext
await llmClient.callLLM({
  context: state.executionContext,  // Full capsule, not individual fields
  systemMessage: "You are a helpful assistant",
  userMessage: state.userMessage,
  callerName: "my-workflow",
});

// Observability Service: Receives full ExecutionContext
await observability.emit({
  context: state.executionContext,  // Full capsule
  threadId: state.executionContext.taskId,
  status: "processing",
  message: "Processing step 1",
});
```

### Key Principles

1. **Never construct ExecutionContext in backend**: Backend receives it from front-end or from existing records
2. **Pass the whole capsule**: Never cherry-pick individual fields (userId, taskId, etc.)
3. **Immutable during workflow**: Don't modify ExecutionContext during workflow execution
4. **Backend may enrich**: Backend can add planId/deliverableId and return updated capsule
5. **Front-end updates store**: Front-end should update its store with returned ExecutionContext

### Anti-Patterns

```typescript
// ❌ BAD: Constructing ExecutionContext in backend
const context: ExecutionContext = {
  orgSlug: req.user.orgSlug,
  userId: req.user.id,
  // ... constructing from scratch
};

// ❌ BAD: Cherry-picking fields
await service.process(
  context.userId,
  context.taskId,
  context.conversationId
);

// ❌ BAD: Extracting then passing
const { userId, taskId } = context;
await service.process(userId, taskId);

// ✅ GOOD: Pass the whole capsule
await service.process(context);
```

## Human-in-the-Loop (HITL) Pattern

LangGraph supports **Human-in-the-Loop (HITL)** workflows that pause execution for human review and resume based on human decisions. The Extended Post Writer agent demonstrates this pattern.

### HITL Architecture

**Key Components:**
1. **HitlBaseStateAnnotation**: Base state with HITL fields (`hitlDecision`, `hitlFeedback`, `hitlPending`)
2. **Interrupt Nodes**: Nodes that set `hitlPending: true` and use `interrupt()` to pause execution
3. **Resume API**: Endpoint that accepts HITL decision and resumes workflow with `Command(resume: decision)`
4. **Postgres Checkpointer**: Persists workflow state during pause, enabling resume

### HITL State Fields

```typescript
export const HitlBaseStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  // ExecutionContext (REQUIRED)
  executionContext: Annotation<ExecutionContext>({ /* ... */ }),

  // HITL State
  hitlDecision: Annotation<HitlDecision | null>({  // "approve" | "edit" | "reject"
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlFeedback: Annotation<string | null>({  // User feedback/comments
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlPending: Annotation<boolean>({  // True when waiting for human
    reducer: (_, next) => next,
    default: () => false,
  }),
  hitlNodeName: Annotation<string | null>({  // Which node triggered HITL
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Workflow Status
  status: Annotation<HitlStatus>({  // "started" | "hitl_waiting" | "completed" | etc.
    reducer: (_, next) => next,
    default: () => "started",
  }),
});
```

### HITL Workflow Example

**Step 1: Generate Content and Pause**

```typescript
async function generateContentNode(state: ExtendedPostWriterState) {
  const ctx = state.executionContext;

  // Generate content via LLM
  const content = await llmClient.callLLM({
    context: ctx,
    systemMessage: "You are a content writer",
    userMessage: state.userMessage,
    callerName: "extended-post-writer",
  });

  // Emit HITL waiting event
  await observability.emitHitlWaiting(
    ctx,
    ctx.taskId,
    content.text,
    "Content generated. Awaiting human review."
  );

  // Set HITL state and interrupt
  return {
    generatedContent: content.text,
    hitlPending: true,
    hitlNodeName: "generate_content",
    status: "hitl_waiting" as HitlStatus,
  };
}

// Use interrupt() to pause workflow
graph.addNode("generate_content", async (state) => {
  const updates = await generateContentNode(state);
  return interrupt(updates);  // Pauses execution here
});
```

**Step 2: Human Reviews and Decides**

Human reviews content via frontend and makes a decision:
- **Approve**: Content is good, continue workflow
- **Edit**: Content needs changes, human provides edited version
- **Reject**: Content is not acceptable, abort workflow

**Step 3: Resume Workflow**

```typescript
// Controller: Resume endpoint
@Post('resume/:threadId')
async resume(
  @Param('threadId') threadId: string,
  @Body() request: ExtendedPostWriterResumeDto
) {
  return await this.service.resume(threadId, {
    decision: request.decision,        // "approve" | "edit" | "reject"
    editedContent: request.editedContent,  // Optional: human-edited content
    feedback: request.feedback,        // Optional: human feedback
  });
}

// Service: Resume with Command
async resume(threadId: string, hitlResponse: HitlResponse) {
  // Resume workflow with Command(resume: value)
  const result = await this.graph.invoke(
    null,  // No new input needed
    {
      configurable: {
        thread_id: threadId,  // Load checkpointed state
      },
      resumeValue: {
        decision: hitlResponse.decision,
        editedContent: hitlResponse.editedContent,
        feedback: hitlResponse.feedback,
      },
    }
  );

  return result;
}
```

**Step 4: Process HITL Decision**

```typescript
async function processDecisionNode(state: ExtendedPostWriterState) {
  const ctx = state.executionContext;
  const decision = state.hitlDecision;

  // Emit resume event
  await observability.emitHitlResumed(
    ctx,
    ctx.taskId,
    decision,
    `Human decision: ${decision}`
  );

  if (decision === "approve") {
    // Use generated content as-is
    return {
      finalContent: state.generatedContent,
      status: "completed" as HitlStatus,
    };
  } else if (decision === "edit") {
    // Use human-edited content
    return {
      finalContent: state.hitlFeedback,  // Or state.editedContent
      status: "completed" as HitlStatus,
    };
  } else if (decision === "reject") {
    // Abort workflow
    return {
      status: "rejected" as HitlStatus,
      error: "Content rejected by human reviewer",
    };
  }
}
```

### HITL Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  POST /extended-post-writer/generate                        │
│  { context: {...}, userMessage: "..." }                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ Generate       │  LLM generates content
         │ Content Node   │  Sets hitlPending=true
         └────────┬───────┘  Calls interrupt()
                  │
                  ▼
         ┌────────────────┐
         │ PAUSED         │  State saved in Postgres checkpointer
         │ hitl_waiting   │  Returns to caller with status="hitl_waiting"
         └────────────────┘
                  │
                  │  Human reviews in UI
                  │  Makes decision: approve/edit/reject
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /extended-post-writer/resume/:threadId                │
│  { decision: "approve", editedContent: "...", feedback: "" }│
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ RESUMED        │  Load checkpointed state
         │ Command(resume)│  Process decision
         └────────┬───────┘
                  │
                  ▼
         ┌────────────────┐
         │ Process        │  approve → use generated content
         │ Decision Node  │  edit → use edited content
         └────────┬───────┘  reject → abort workflow
                  │
                  ▼
         ┌────────────────┐
         │ COMPLETED      │  Returns final content
         │ or REJECTED    │  with status
         └────────────────┘
```

### HITL Best Practices

1. **Use HitlBaseStateAnnotation**: Extend it for all HITL workflows to get standard HITL fields
2. **Emit observability events**: Use `emitHitlWaiting()` and `emitHitlResumed()` for visibility
3. **Use interrupt()**: Call `interrupt()` to pause execution and save state
4. **Thread ID is taskId**: Always use `context.taskId` as LangGraph thread ID for consistency
5. **Validate decision**: Check `hitlDecision` in processing node to handle approve/edit/reject
6. **Non-blocking pause**: HITL pause should return immediately to caller, not block the HTTP request
7. **Frontend polling**: Frontend should poll status endpoint to detect when workflow is waiting

### HITL Status Endpoint

```typescript
@Get('status/:threadId')
async getStatus(@Param('threadId') threadId: string) {
  const status = await this.service.getStatus(threadId);
  return {
    success: true,
    data: {
      status: status.status,           // "started" | "hitl_waiting" | "completed"
      hitlPending: status.hitlPending, // true if waiting for human
      generatedContent: status.generatedContent, // Content to review
      // ... other fields
    }
  };
}
```

Frontend polls this endpoint to detect `hitl_waiting` status and display review UI.

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Coverage
```bash
npm run test:cov
```

## Project Structure

```
apps/langgraph/
├── src/
│   ├── main.ts                          # Application entry point
│   ├── app.module.ts                    # Root module
│   ├── common/
│   │   └── dto/                         # Shared DTOs
│   ├── services/
│   │   ├── llm-http-client.service.ts   # LLM integration
│   │   └── webhook-status.service.ts    # Progress streaming
│   ├── workflows/
│   │   ├── workflows.controller.ts      # HTTP endpoints
│   │   ├── workflows.service.ts         # Workflow orchestration
│   │   ├── workflows.module.ts
│   │   ├── graphs/                      # Workflow implementations
│   │   │   ├── marketing-swarm.graph.ts
│   │   │   ├── requirements-writer.graph.ts
│   │   │   └── metrics-agent.graph.ts
│   │   └── nodes/
│   │       └── llm-node.ts              # Reusable LLM executor
│   └── health/
│       └── health.controller.ts         # Health checks
├── sql/
│   └── insert-api-agents.sql            # Database setup
├── test/                                # Tests
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env
```

## Dependencies

- **@nestjs/core** - NestJS framework
- **@nestjs/axios** - HTTP client
- **@langchain/langgraph** - LangGraph TypeScript SDK
- **class-validator** - Input validation
- **rxjs** - Reactive programming

## Troubleshooting

### Port Already in Use
```bash
lsof -ti:7200 | xargs kill -9
```

### LLM Service Connection Failed
- Ensure `apps/api` is running on port 6100
- Check `LLM_SERVICE_URL` in `.env`

### Webhook Delivery Failed
- Webhook failures are logged but don't break workflow execution
- Check webhook endpoint is accessible

## Development

### Adding a New Workflow

1. Create workflow graph in `src/workflows/graphs/my-workflow.graph.ts`
2. Add method to `workflows.service.ts`
3. Add endpoint to `workflows.controller.ts`
4. Create API agent SQL in `sql/`
5. Add tests

### Code Style
```bash
npm run lint
npm run format
```

## Performance

- **Marketing Swarm**: ~30-60 seconds (3 LLM calls)
- **Requirements Writer**: ~60-120 seconds (6 LLM calls)
- **Metrics Agent**: ~15-30 seconds (2 LLM calls)

Times vary based on LLM provider, model, and content complexity.

## License

See root LICENSE file.
