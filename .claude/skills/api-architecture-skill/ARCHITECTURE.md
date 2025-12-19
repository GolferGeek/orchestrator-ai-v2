# Module/Controller/Service Architecture

The API follows a strict NestJS module/controller/service architecture.

## Layer Responsibilities

### Module Layer (`*.module.ts`)

**Purpose**: Dependency injection configuration

**Responsibilities**:
- Define module dependencies (imports)
- Register controllers
- Register providers (services)
- Export services for use in other modules

**What Modules DO:**
- ✅ Configure dependency injection
- ✅ Import other modules
- ✅ Register controllers and providers
- ✅ Export services for reuse

**What Modules DON'T DO:**
- ❌ No business logic
- ❌ No HTTP handling
- ❌ No data processing

**Example**:
```typescript
@Module({
  imports: [HttpModule, SupabaseModule],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
```

### Controller Layer (`*.controller.ts`)

**Purpose**: HTTP request/response handling

**Responsibilities**:
- Handle HTTP requests
- Validate request data
- Delegate to services
- Format responses

**What Controllers DO:**
- ✅ Handle HTTP endpoints
- ✅ Validate requests (via DTOs)
- ✅ Delegate to services
- ✅ Format responses

**What Controllers DON'T DO:**
- ❌ No business logic (delegates to services)
- ❌ No database operations (delegates to services)
- ❌ No complex data processing (delegates to services)

**Example**:
```typescript
@Controller('feature')
export class FeatureController {
  constructor(private readonly service: FeatureService) {}
  
  @Get()
  async getData(@Query() query: QueryDto): Promise<ResponseDto> {
    return this.service.getData(query);
  }
  
  @Post()
  async createData(@Body() body: CreateDto): Promise<ResponseDto> {
    return this.service.createData(body);
  }
}
```

### Service Layer (`*.service.ts`)

**Purpose**: Business logic and data processing

**Responsibilities**:
- Implement business logic
- Process data
- Coordinate with other services
- Handle database operations

**What Services DO:**
- ✅ Contain business logic
- ✅ Process data
- ✅ Coordinate services
- ✅ Handle database operations

**What Services DON'T DO:**
- ❌ No HTTP handling (handled by controllers)
- ❌ No request/response formatting (handled by controllers)

**Example**:
```typescript
@Injectable()
export class FeatureService {
  constructor(
    private readonly repository: Repository,
    private readonly otherService: OtherService,
  ) {}
  
  async getData(query: QueryDto): Promise<ResponseDto> {
    // Business logic
    const data = await this.repository.find(query);
    return this.processData(data);
  }
}
```

## Data Flow

### Request Flow

```
HTTP Request → Controller → Service → Repository/Database → Service → Controller → HTTP Response
```

1. HTTP request arrives at controller
2. Controller validates request (via DTOs)
3. Controller delegates to service
4. Service implements business logic
5. Service accesses database/repository
6. Service processes data
7. Service returns result to controller
8. Controller formats response
9. HTTP response sent to client

### ExecutionContext Flow

```
Controller (receives from request) → Service (passes through) → Runner (uses for execution)
```

1. Controller receives ExecutionContext from request body
2. Controller validates ExecutionContext (userId matches JWT)
3. Controller passes ExecutionContext to service
4. Service passes ExecutionContext to runner
5. Runner uses ExecutionContext for agent execution
6. ExecutionContext returned in response

## Layer Violations

### Module Violations

**❌ Bad: Business Logic in Module**
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

**✅ Good: Module Only Configures DI**
```typescript
@Module({
  imports: [HttpModule],
  controllers: [FeatureController],
  providers: [FeatureService],
})
export class FeatureModule {}
```

### Controller Violations

**❌ Bad: Business Logic in Controller**
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

**✅ Good: Controller Delegates to Service**
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

### Service Violations

**❌ Bad: HTTP Handling in Service**
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

**✅ Good: Service Contains Business Logic**
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

## Dependency Injection

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

## Related

- **`FILE_CLASSIFICATION.md`**: How to classify files by layer
- **`PATTERNS.md`**: API-specific patterns
- **`RUNNERS.md`**: Agent runner patterns
- **`VIOLATIONS.md`**: Common violations and fixes

