# File Classification

How to classify API files by type and location.

## Classification Rules

### 1. Controller Files

**Location**: `apps/api/src/[feature]/[name].controller.ts`

**Pattern**: `[name].controller.ts`
- Examples: `agent2agent.controller.ts`, `llm.controller.ts`, `auth.controller.ts`

**Structure**:
```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';

@Controller('path')
export class FeatureController {
  constructor(private readonly service: FeatureService) {}
  
  @Get()
  async getData(): Promise<ResponseDto> {
    return this.service.getData();
  }
  
  @Post()
  async createData(@Body() body: CreateDto): Promise<ResponseDto> {
    return this.service.createData(body);
  }
}
```

**Responsibilities**:
- HTTP request/response handling
- Request validation
- Delegation to services
- Response formatting

**Validation**:
- ✅ Uses `@Controller` decorator
- ✅ Uses HTTP method decorators (`@Get`, `@Post`, etc.)
- ✅ Constructor injection for services
- ✅ No business logic (delegates to services)

### 2. Service Files

**Location**: `apps/api/src/[feature]/[name].service.ts`

**Pattern**: `[name].service.ts`
- Examples: `agent-tasks.service.ts`, `llm.service.ts`, `auth.service.ts`

**Structure**:
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class FeatureService {
  constructor(
    private readonly repository: Repository,
    private readonly otherService: OtherService,
  ) {}
  
  async getData(): Promise<ResponseDto> {
    // Business logic
  }
}
```

**Responsibilities**:
- Business logic
- Data processing
- Service coordination
- Database operations

**Validation**:
- ✅ Uses `@Injectable` decorator
- ✅ Constructor injection for dependencies
- ✅ Contains business logic
- ✅ No HTTP handling (handled by controllers)

### 3. Module Files

**Location**: `apps/api/src/[feature]/[name].module.ts`

**Pattern**: `[name].module.ts`
- Examples: `agent2agent.module.ts`, `llm.module.ts`, `auth.module.ts`

**Structure**:
```typescript
import { Module } from '@nestjs/common';

@Module({
  imports: [/* other modules */],
  controllers: [/* controllers */],
  providers: [/* services */],
  exports: [/* exported services */],
})
export class FeatureModule {}
```

**Responsibilities**:
- Dependency injection configuration
- Module imports/exports
- Provider registration

**Validation**:
- ✅ Uses `@Module` decorator
- ✅ Defines imports, controllers, providers, exports
- ✅ No business logic
- ✅ No HTTP handling

### 4. Runner Files

**Location**: `apps/api/src/agent2agent/services/[type]-agent-runner.service.ts`

**Pattern**: `[type]-agent-runner.service.ts`
- Examples: `context-agent-runner.service.ts`, `api-agent-runner.service.ts`, `rag-agent-runner.service.ts`

**Structure**:
```typescript
import { Injectable } from '@nestjs/common';
import { BaseAgentRunner } from './base-agent-runner.service';

@Injectable()
export class CustomAgentRunnerService extends BaseAgentRunner {
  constructor(
    llmService: LLMService,
    contextOptimization: ContextOptimizationService,
    // ... other dependencies
  ) {
    super(/* pass to base */);
  }
  
  protected async handleConverse(...): Promise<TaskResponseDto> {
    // CONVERSE mode implementation
  }
  
  protected async handlePlan(...): Promise<TaskResponseDto> {
    // PLAN mode implementation
  }
  
  protected async handleBuild(...): Promise<TaskResponseDto> {
    // BUILD mode implementation
  }
}
```

**Responsibilities**:
- Agent execution
- Mode routing (CONVERSE, PLAN, BUILD, HITL)
- Agent-specific logic

**Validation**:
- ✅ Extends `BaseAgentRunner`
- ✅ Implements mode handlers
- ✅ Registered in `AgentRunnerRegistryService`
- ✅ Uses `@Injectable` decorator

### 5. DTO Files

**Location**: `apps/api/src/[feature]/dto/[name].dto.ts`

**Pattern**: `[name].dto.ts`
- Examples: `task-request.dto.ts`, `create-user.dto.ts`

**Structure**:
```typescript
import { IsString, IsOptional } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  name!: string;
  
  @IsOptional()
  @IsString()
  description?: string;
}
```

**Responsibilities**:
- Data transfer object definitions
- Validation rules
- Type definitions

**Validation**:
- ✅ Class-based (not interface)
- ✅ Uses validation decorators
- ✅ Exported for use in controllers/services

### 6. Interface Files

**Location**: `apps/api/src/[feature]/[name].interface.ts` or `interfaces/[name].interface.ts`

**Pattern**: `[name].interface.ts`
- Examples: `agent-runner.interface.ts`, `agent.interface.ts`

**Structure**:
```typescript
export interface FeatureInterface {
  id: string;
  name: string;
  // ...
}
```

**Responsibilities**:
- TypeScript type definitions
- Interface contracts
- Shared type definitions

**Validation**:
- ✅ Type definitions only
- ✅ No runtime code
- ✅ Exported for use in other files

## Classification Process

### Step 1: Check Location

**If in `[feature]/` with `.controller.ts`:**
- Must be a controller file
- Must follow controller patterns
- Must have `Controller` suffix

**If in `[feature]/` with `.service.ts`:**
- Must be a service file
- Must follow service patterns
- Must have `Service` suffix

**If in `[feature]/` with `.module.ts`:**
- Must be a module file
- Must follow module patterns
- Must have `Module` suffix

**If in `agent2agent/services/` with `-agent-runner.service.ts`:**
- Must be a runner file
- Must extend `BaseAgentRunner`
- Must follow runner patterns

**If in `dto/` with `.dto.ts`:**
- Must be a DTO file
- Must follow DTO patterns

**If with `.interface.ts`:**
- Must be an interface file
- Must contain type definitions only

### Step 2: Check Naming

**Controller**: `[name].controller.ts`
**Service**: `[name].service.ts`
**Module**: `[name].module.ts`
**Runner**: `[type]-agent-runner.service.ts`
**DTO**: `[name].dto.ts`
**Interface**: `[name].interface.ts`

### Step 3: Check Structure

**Controller**: `@Controller`, HTTP method decorators, constructor injection
**Service**: `@Injectable`, constructor injection, business logic methods
**Module**: `@Module`, imports/controllers/providers/exports
**Runner**: Extends `BaseAgentRunner`, implements mode handlers
**DTO**: Class with validation decorators
**Interface**: TypeScript interface definitions

### Step 4: Validate Responsibilities

**Controller**: HTTP handling, validation, delegation
**Service**: Business logic, data processing
**Module**: Dependency injection configuration
**Runner**: Agent execution, mode routing
**DTO**: Data transfer, validation
**Interface**: Type definitions

## Examples

### Example 1: Controller File

**File**: `apps/api/src/agent2agent/agent2agent.controller.ts`

**Classification**:
- ✅ Location: `agent2agent/` with `.controller.ts` → Controller
- ✅ Naming: `controller.ts` suffix → Controller
- ✅ Structure: `@Controller`, HTTP decorators → Controller
- ✅ Responsibilities: HTTP handling, delegation → Controller

**Result**: Controller file

### Example 2: Service File

**File**: `apps/api/src/agent2agent/services/agent-tasks.service.ts`

**Classification**:
- ✅ Location: `services/` with `.service.ts` → Service
- ✅ Naming: `service.ts` suffix → Service
- ✅ Structure: `@Injectable`, constructor injection → Service
- ✅ Responsibilities: Business logic → Service

**Result**: Service file

### Example 3: Runner File

**File**: `apps/api/src/agent2agent/services/context-agent-runner.service.ts`

**Classification**:
- ✅ Location: `agent2agent/services/` with `-agent-runner.service.ts` → Runner
- ✅ Naming: `-agent-runner.service.ts` suffix → Runner
- ✅ Structure: Extends `BaseAgentRunner` → Runner
- ✅ Responsibilities: Agent execution, mode routing → Runner

**Result**: Runner file

## Related

- **`PATTERNS.md`**: API-specific patterns
- **`ARCHITECTURE.md`**: Module/controller/service architecture
- **`RUNNERS.md`**: Agent runner patterns
- **`VIOLATIONS.md`**: Common violations

