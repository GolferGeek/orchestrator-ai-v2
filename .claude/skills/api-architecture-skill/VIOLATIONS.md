# Common Violations

Common API architecture violations and how to fix them.

## Module Violations

### Violation 1: Business Logic in Module

**❌ Bad**:
```typescript
@Module({
  // ...
})
export class FeatureModule {
  // WRONG: Module should not contain business logic
  async processData() {
    // ...
  }
}
```

**✅ Good**:
```typescript
@Module({
  imports: [HttpModule],
  controllers: [FeatureController],
  providers: [FeatureService],
})
export class FeatureModule {}
```

### Violation 2: HTTP Handling in Module

**❌ Bad**:
```typescript
@Module({
  // ...
})
export class FeatureModule {
  // WRONG: Module should not handle HTTP
  @Get()
  async getData() {
    // ...
  }
}
```

**✅ Good**:
```typescript
@Module({
  controllers: [FeatureController], // HTTP handling in controller
  providers: [FeatureService],
})
export class FeatureModule {}
```

## Controller Violations

### Violation 1: Business Logic in Controller

**❌ Bad**:
```typescript
@Controller('feature')
export class FeatureController {
  // WRONG: Controller should not contain business logic
  @Get()
  async getData() {
    const data = await this.repository.find(); // Direct database access
    return this.processData(data); // Business logic
  }
}
```

**✅ Good**:
```typescript
@Controller('feature')
export class FeatureController {
  constructor(private readonly service: FeatureService) {}
  
  @Get()
  async getData(): Promise<ResponseDto> {
    return this.service.getData(); // Delegate to service
  }
}
```

### Violation 2: Missing Validation

**❌ Bad**:
```typescript
@Post()
async createData(@Body() body: any): Promise<any> {
  // WRONG: No validation, any types
  return this.service.createData(body);
}
```

**✅ Good**:
```typescript
@Post()
async createData(@Body() body: CreateDto): Promise<ResponseDto> {
  // DTO with validation decorators
  return this.service.createData(body);
}
```

## Service Violations

### Violation 1: HTTP Handling in Service

**❌ Bad**:
```typescript
@Injectable()
export class FeatureService {
  // WRONG: Service should not handle HTTP
  @Get()
  async getData() {
    // ...
  }
}
```

**✅ Good**:
```typescript
@Injectable()
export class FeatureService {
  async getData(): Promise<ResponseDto> {
    // Business logic only
    const data = await this.repository.find();
    return this.processData(data);
  }
}
```

### Violation 2: Missing Dependency Injection

**❌ Bad**:
```typescript
@Injectable()
export class FeatureService {
  // WRONG: Direct instantiation instead of DI
  private repository = new Repository();
}
```

**✅ Good**:
```typescript
@Injectable()
export class FeatureService {
  constructor(
    private readonly repository: Repository,
  ) {}
}
```

## ExecutionContext Violations

### Violation 1: Creating ExecutionContext

**❌ Bad**:
```typescript
// WRONG: Never create ExecutionContext
const context: ExecutionContext = {
  orgSlug: 'demo-org',
  userId: 'user-123',
  conversationId: 'conv-123',
  // ...
};
```

**✅ Good**:
```typescript
// Get ExecutionContext from request (created by frontend)
const context = body.context;
```

### Violation 2: Cherry-Picking ExecutionContext Fields

**❌ Bad**:
```typescript
const context = body.context;

// WRONG: Don't cherry-pick fields
await this.service.call(context.orgSlug, context.userId);
```

**✅ Good**:
```typescript
const context = body.context;

// Pass entire context
await this.service.call(context);
```

### Violation 3: Mutating Forbidden Fields

**❌ Bad**:
```typescript
// WRONG: Mutating forbidden fields
context.orgSlug = 'new-org';
context.userId = 'new-user';
```

**✅ Good**:
```typescript
// Only mutate allowed fields when creating new IDs
if (result.deliverableId && context.deliverableId === NIL_UUID) {
  context.deliverableId = result.deliverableId;
}
```

### Violation 4: Not Validating ExecutionContext

**❌ Bad**:
```typescript
@Post()
async executeTask(@Body() body: TaskRequestDto): Promise<TaskResponseDto> {
  // WRONG: No validation
  return this.service.executeTask(body.context, body);
}
```

**✅ Good**:
```typescript
@Post()
async executeTask(
  @Body() body: TaskRequestDto,
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
  
  return this.service.executeTask(body.context, body);
}
```

## Runner Violations

### Violation 1: Not Extending BaseAgentRunner

**❌ Bad**:
```typescript
@Injectable()
export class CustomAgentRunnerService {
  // WRONG: Should extend BaseAgentRunner
  async execute(...) {
    // ...
  }
}
```

**✅ Good**:
```typescript
@Injectable()
export class CustomAgentRunnerService extends BaseAgentRunner {
  constructor(
    llmService: LLMService,
    // ... other dependencies
  ) {
    super(/* pass to base */);
  }
  
  protected async handleConverse(...): Promise<TaskResponseDto> {
    // Implementation
  }
}
```

### Violation 2: Not Registering Runner

**❌ Bad**:
```typescript
// WRONG: Runner not registered
export class CustomAgentRunnerService extends BaseAgentRunner {
  // ...
}
```

**✅ Good**:
```typescript
// In AgentRunnerRegistryService
this.registerRunner('custom-type', this.customAgentRunner);
```

## A2A Protocol Violations

### Violation 1: Not Using JSON-RPC 2.0 Format

**❌ Bad**:
```typescript
// WRONG: Custom format instead of JSON-RPC 2.0
const response = {
  action: 'create',
  data: { ... },
};
```

**✅ Good**:
```typescript
// Use JSON-RPC 2.0 format
const response = {
  jsonrpc: '2.0',
  result: { ... },
  id: 'request-id',
};
```

### Violation 2: Missing Transport Types

**❌ Bad**:
```typescript
// WRONG: No transport type validation
const request = {
  mode: 'build',
  userMessage: '...',
};
```

**✅ Good**:
```typescript
// Use transport types
const request: TaskRequestDto = {
  mode: 'build',
  userMessage: '...',
  context: ExecutionContext,
  // ... transport type fields
};
```

## File Location Violations

### Violation 1: Controller in Wrong Location

**❌ Bad**:
```
apps/api/src/services/controller.ts  // WRONG: Controller in services/
```

**✅ Good**:
```
apps/api/src/feature/feature.controller.ts  // Correct: Controller in feature/
```

### Violation 2: Service in Wrong Location

**❌ Bad**:
```
apps/api/src/controllers/service.ts  // WRONG: Service in controllers/
```

**✅ Good**:
```
apps/api/src/feature/feature.service.ts  // Correct: Service in feature/
```

### Violation 3: Runner in Wrong Location

**❌ Bad**:
```
apps/api/src/feature/runner.service.ts  // WRONG: Runner not in agent2agent/services/
```

**✅ Good**:
```
apps/api/src/agent2agent/services/custom-agent-runner.service.ts  // Correct: Runner in agent2agent/services/
```

## Naming Convention Violations

### Violation 1: Controller Without "Controller" Suffix

**❌ Bad**:
```
apps/api/src/feature/feature.ts  // WRONG: Missing "Controller" suffix
```

**✅ Good**:
```
apps/api/src/feature/feature.controller.ts  // Correct: Has "Controller" suffix
```

### Violation 2: Service Without "Service" Suffix

**❌ Bad**:
```
apps/api/src/feature/feature.ts  // WRONG: Missing "Service" suffix
```

**✅ Good**:
```
apps/api/src/feature/feature.service.ts  // Correct: Has "Service" suffix
```

### Violation 3: Runner Without Proper Naming

**❌ Bad**:
```
apps/api/src/agent2agent/services/custom.service.ts  // WRONG: Not following runner naming
```

**✅ Good**:
```
apps/api/src/agent2agent/services/custom-agent-runner.service.ts  // Correct: Follows runner naming
```

## Related

- **`FILE_CLASSIFICATION.md`**: File classification rules
- **`ARCHITECTURE.md`**: Module/controller/service architecture
- **`PATTERNS.md`**: API-specific patterns
- **`RUNNERS.md`**: Agent runner patterns

