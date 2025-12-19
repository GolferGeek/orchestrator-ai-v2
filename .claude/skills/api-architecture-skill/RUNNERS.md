# Agent Runner Patterns

Agent runners execute agents in different modes (CONVERSE, PLAN, BUILD, HITL).

## Runner Structure

### Base Runner

All runners extend `BaseAgentRunner`:

```typescript
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { TaskRequestDto, TaskResponseDto } from '../dto';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

@Injectable()
export class CustomAgentRunnerService extends BaseAgentRunner {
  constructor(
    llmService: LLMService,
    contextOptimization: ContextOptimizationService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
    deliverablesService: DeliverablesService,
    streamingService: StreamingService,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
      streamingService,
    );
  }
}
```

### Mode Handlers

Runners implement mode handlers:

```typescript
protected async handleConverse(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  context: ExecutionContext,
): Promise<TaskResponseDto> {
  // CONVERSE mode implementation
}

protected async handlePlan(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  context: ExecutionContext,
): Promise<TaskResponseDto> {
  // PLAN mode implementation
}

protected async handleBuild(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  context: ExecutionContext,
): Promise<TaskResponseDto> {
  // BUILD mode implementation
}

protected async handleHitl(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  context: ExecutionContext,
): Promise<TaskResponseDto> {
  // HITL mode implementation
}
```

## Runner Types

### Context Runner

**Type**: `context`

**Purpose**: Fetch context and use LLM to generate responses

**Pattern**:
- Fetch context from configured sources
- Optimize context to token budget
- Combine with markdown from context column
- Interpolate into system prompt template
- Make ONE LLM call
- Save deliverable

**Location**: `context-agent-runner.service.ts`

### API Runner

**Type**: `api`

**Purpose**: Make HTTP API calls

**Pattern**:
- Make HTTP requests (GET, POST, PUT, DELETE, PATCH)
- Support request headers, body, query params
- Handle authentication
- Transform responses
- Store API results as deliverables

**Location**: `api-agent-runner.service.ts`

### External Runner

**Type**: `external`

**Purpose**: Call external services

**Pattern**:
- Call external HTTP endpoints
- Handle authentication
- Process responses
- Return standardized format

**Location**: `external-agent-runner.service.ts`

### Orchestrator Runner

**Type**: `orchestrator`

**Purpose**: Coordinate multiple agents

**Pattern**:
- Delegate to multiple agents
- Coordinate execution
- Aggregate results
- Return combined response

**Location**: `orchestrator-agent-runner.service.ts`

### RAG Runner

**Type**: `rag-runner`

**Purpose**: Query RAG collections and augment LLM responses

**Pattern**:
- Query RAG collection
- Retrieve relevant documents
- Augment LLM prompt with context
- Generate response
- Return result

**Location**: `rag-agent-runner.service.ts`

### Media Runner

**Type**: `media`

**Purpose**: Handle media generation (images, video)

**Pattern**:
- Generate media via external services
- Store media files
- Return media URLs
- Save as deliverables

**Location**: `media-agent-runner.service.ts`

## Runner Registration

Runners must be registered in `AgentRunnerRegistryService`:

```typescript
// In AgentRunnerRegistryService constructor
this.registerRunner('context', this.contextAgentRunner);
this.registerRunner('api', this.apiAgentRunner);
this.registerRunner('external', this.externalAgentRunner);
this.registerRunner('orchestrator', this.orchestratorAgentRunner);
this.registerRunner('rag-runner', this.ragAgentRunner);
this.registerRunner('media', this.mediaAgentRunner);
```

## ExecutionContext in Runners

**Receiving ExecutionContext**:
```typescript
protected async handleBuild(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  context: ExecutionContext, // Received from base class
): Promise<TaskResponseDto> {
  // Use context for execution
  const { userId, conversationId, taskId } = context;
}
```

**Passing ExecutionContext**:
```typescript
// Pass context to service calls
await this.llmService.generateResponse({
  systemPrompt: '...',
  userPrompt: '...',
  context, // Pass whole context
});
```

**Updating ExecutionContext**:
```typescript
// Only update when creating new IDs
if (result.deliverableId && context.deliverableId === NIL_UUID) {
  context.deliverableId = result.deliverableId;
}
```

## Mode Routing

The base class routes to appropriate handlers:

```typescript
async execute(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const mode = request.mode;
  
  switch (mode) {
    case 'converse':
      return this.handleConverse(definition, request, context);
    case 'plan':
      return this.handlePlan(definition, request, context);
    case 'build':
      return this.handleBuild(definition, request, context);
    case 'hitl':
      return this.handleHitl(definition, request, context);
    default:
      throw new Error(`Unsupported mode: ${mode}`);
  }
}
```

## Related

- **`FILE_CLASSIFICATION.md`**: How to classify runner files
- **`ARCHITECTURE.md`**: Module/controller/service architecture
- **`PATTERNS.md`**: API-specific patterns
- **`VIOLATIONS.md`**: Common violations and fixes

