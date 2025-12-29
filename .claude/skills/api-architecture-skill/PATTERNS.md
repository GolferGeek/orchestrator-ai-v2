# API Patterns

API-specific patterns and best practices for NestJS applications.

## NestJS Decorator Patterns

### Controller Decorators

**@Controller**:
```typescript
@Controller('path')
export class FeatureController {}
```

**HTTP Method Decorators**:
```typescript
@Get()
@Post()
@Put()
@Delete()
@Patch()
```

**Parameter Decorators**:
```typescript
@Body() body: CreateDto
@Query() query: QueryDto
@Param('id') id: string
@Headers() headers: Record<string, string>
@CurrentUser() user: UserDto
```

### Service Decorators

**@Injectable**:
```typescript
@Injectable()
export class FeatureService {}
```

### Module Decorators

**@Module**:
```typescript
@Module({
  imports: [/* modules */],
  controllers: [/* controllers */],
  providers: [/* services */],
  exports: [/* services */],
})
export class FeatureModule {}
```

## Dependency Injection Patterns

### Constructor Injection

**Preferred Pattern**:
```typescript
@Injectable()
export class FeatureService {
  constructor(
    private readonly repository: Repository,
    private readonly otherService: OtherService,
  ) {}
}
```

**Why**: Clean, testable, follows NestJS patterns

### Module Registration

**Providers**:
```typescript
@Module({
  providers: [
    FeatureService,
    OtherService,
  ],
})
```

**Exports**:
```typescript
@Module({
  providers: [FeatureService],
  exports: [FeatureService], // Available to other modules
})
```

## ExecutionContext Patterns

### Receiving ExecutionContext in Controller

**From Request Body**:
```typescript
@Post('agent-to-agent/:orgSlug/:agentSlug/tasks')
async executeTask(
  @Body() body: TaskRequestDto, // Contains context
  @CurrentUser() currentUser: SupabaseAuthUserDto,
): Promise<TaskResponseDto> {
  // Validate ExecutionContext exists
  if (!body.context) {
    throw new BadRequestException('ExecutionContext is required');
  }
  
  // Validate userId matches authenticated user
  if (body.context.userId !== currentUser.id) {
    throw new UnauthorizedException('Context userId does not match authenticated user');
  }
  
  // Pass ExecutionContext to service
  return this.service.executeTask(body.context, body);
}
```

### Passing ExecutionContext in Service

**To Runner**:
```typescript
async executeTask(
  context: ExecutionContext,
  request: TaskRequestDto,
): Promise<TaskResponseDto> {
  // Pass context to runner
  const result = await this.runner.execute(definition, request, context.orgSlug);
  
  // Update context only when creating new IDs
  if (result.deliverableId && context.deliverableId === NIL_UUID) {
    context.deliverableId = result.deliverableId;
  }
  
  // Return context in response
  return { ...result, context };
}
```

### ExecutionContext Mutations

**✅ Allowed Mutations**:
- `taskId` - When creating new task
- `deliverableId` - When creating new deliverable
- `planId` - When creating new plan

**❌ Forbidden Mutations**:
- `orgSlug` - Never mutate
- `userId` - Never mutate
- `conversationId` - Never mutate
- `agentSlug` - Never mutate
- `agentType` - Never mutate
- `provider` - Never mutate
- `model` - Never mutate

## A2A Protocol Patterns

### JSON-RPC 2.0 Format

**Request**:
```typescript
{
  jsonrpc: '2.0',
  method: 'build.create',
  params: {
    mode: 'build',
    userMessage: '...',
    context: ExecutionContext,
  },
  id: 'request-id',
}
```

**Response**:
```typescript
{
  jsonrpc: '2.0',
  result: {
    type: 'deliverable',
    deliverable: { ... },
    context: ExecutionContext,
  },
  id: 'request-id',
}
```

### Transport Types

**Mode-Specific Payloads**:
- `plan` - Planning mode payload
- `build` - Building mode payload
- `converse` - Conversational mode payload
- `hitl` - Human-in-the-loop mode payload

## Error Handling Patterns

### Controller Error Handling

**Try-Catch**:
```typescript
@Post()
async createData(@Body() body: CreateDto): Promise<ResponseDto> {
  try {
    return await this.service.createData(body);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new InternalServerErrorException('Failed to create data');
  }
}
```

### Service Error Handling

**Error Propagation**:
```typescript
async createData(body: CreateDto): Promise<ResponseDto> {
  try {
    // Business logic
    return result;
  } catch (error) {
    this.logger.error('Failed to create data', error);
    throw error; // Let controller handle
  }
}
```

## Validation Patterns

### DTO Validation

**Class Validator**:
```typescript
import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name!: string;
  
  @IsEmail()
  email!: string;
  
  @IsOptional()
  @IsString()
  description?: string;
}
```

### Request Validation

**Validation Pipe**:
```typescript
// Global validation pipe in main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

## LLM Service Patterns

### LLM Service Endpoint

**Purpose**: External API endpoint for LLM calls from LangGraph, N8N, and other external systems.

**Endpoint**: `POST /llm/generate`

**Required**: ExecutionContext in request body

**Pattern**:
```typescript
// External caller (LangGraph, N8N, etc.)
const response = await fetch('/llm/generate', {
  method: 'POST',
  body: JSON.stringify({
    systemPrompt: '...',
    userPrompt: '...',
    context: executionContext, // REQUIRED - full ExecutionContext
    options: {
      temperature: 0.7,
      maxTokens: 1000,
      callerType: 'langgraph', // Track caller for analytics
      callerName: 'marketing-swarm',
    },
  }),
});
```

**Automatic Tracking**:
- Usage tracking via `RunMetadataService`
- Cost calculation via `LLMPricingService`
- PII processing and sanitization
- Provider routing and selection
- Observability event emission

**Usage Recording Endpoint**: `POST /llm/usage`
- For external callers that call specialized LLMs directly (e.g., Ollama/SQLCoder)
- Allows reporting usage for tracking and billing

### LLM Service Integration

**In Services/Runners**:
```typescript
import { LLMService } from '@/llms/llm.service';

@Injectable()
export class CustomService {
  constructor(private readonly llmService: LLMService) {}
  
  async callLLM(
    context: ExecutionContext,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    // LLM service automatically tracks usage and costs
    const result = await this.llmService.generateResponse(
      systemPrompt,
      userPrompt,
      {
        executionContext: context, // REQUIRED
        callerType: 'api',
        callerName: 'custom-service',
      },
    );
    
    return typeof result === 'string' ? result : result.content;
  }
}
```

**Key Points**:
- Always pass full ExecutionContext
- Usage and costing tracked automatically
- PII processing handled automatically
- Observability events emitted automatically

## Observability Patterns

### Observability SSE Streaming

**Purpose**: Real-time monitoring of all agent executions via Server-Sent Events.

**Endpoint**: `GET /observability/stream`

**Pattern**:
```typescript
// Frontend or external client
const eventSource = new EventSource('/observability/stream?conversationId=xxx');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle observability event
};
```

**Event Flow**:
1. Events pushed to `ObservabilityEventsService.push()`
2. Service maintains in-memory buffer (RxJS Subject)
3. Events broadcast to all SSE subscribers
4. Events persisted to database for historical queries

### Sending Observability Events

**From API Services**:
```typescript
import { ObservabilityWebhookService } from '@/observability/observability-webhook.service';

@Injectable()
export class CustomService {
  constructor(
    private readonly observability: ObservabilityWebhookService,
  ) {}
  
  async executeTask(context: ExecutionContext): Promise<void> {
    // Send event with ExecutionContext
    await this.observability.sendEvent({
      context, // REQUIRED - full ExecutionContext
      source_app: 'api',
      hook_event_type: 'task.started',
      status: 'running',
      message: 'Task execution started',
      progress: 0,
      step: 'initialization',
      payload: {
        // Additional event data
      },
    });
  }
}
```

**From External APIs (LangGraph, N8N)**:
```typescript
// External API sends event via webhook
await fetch('/webhooks/status', {
  method: 'POST',
  body: JSON.stringify({
    taskId: context.taskId,
    status: 'running',
    context: executionContext, // REQUIRED - full ExecutionContext
    message: 'Workflow step completed',
    progress: 50,
    step: 'processing',
  }),
});
```

**Key Points**:
- Always include full ExecutionContext in events
- Events automatically enriched with username
- Events buffered in-memory for SSE subscribers
- Events persisted to database for history
- Non-blocking - failures don't break execution

### Observability Event Structure

**ObservabilityEventRecord**:
```typescript
interface ObservabilityEventRecord {
  context: ExecutionContext; // REQUIRED - all identity fields
  source_app: string; // 'api', 'langgraph', 'n8n', etc.
  hook_event_type: string; // 'task.started', 'agent.progress', etc.
  status: string; // 'running', 'completed', 'failed', etc.
  message: string | null; // Human-readable message
  progress: number | null; // 0-100
  step: string | null; // Current step/phase name
  payload: Record<string, unknown>; // Additional event data
  timestamp: number; // Unix timestamp (ms)
}
```

**Event Types**:
- `agent.llm.started` - LLM call started
- `agent.llm.completed` - LLM call completed
- `task.started` - Task execution started
- `task.completed` - Task execution completed
- `agent.progress` - Agent execution progress update
- `langgraph.started` - LangGraph workflow started
- `langgraph.completed` - LangGraph workflow completed

## Related

- **`FILE_CLASSIFICATION.md`**: File classification rules
- **`ARCHITECTURE.md`**: Module/controller/service architecture
- **`RUNNERS.md`**: Agent runner patterns
- **`VIOLATIONS.md`**: Common violations and fixes

