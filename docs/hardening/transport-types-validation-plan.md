# Transport Types Validation Implementation Plan

## Overview
This document outlines the implementation plan for adding runtime validation for A2A (Agent-to-Agent) protocol compliance. All agent communication MUST follow JSON-RPC 2.0 format with strict transport type adherence as defined in `@orchestrator-ai/transport-types`.

**Refactoring ID**: `transport-types-compliance`
**Priority**: CRITICAL
**Status**: BLOCKED - Tests inadequate for safe auto-fixing

## Critical Issues Summary

| Issue ID | Severity | File | Description |
|----------|----------|------|-------------|
| api-008 | MEDIUM | task-request.dto.ts | TaskRequestDto needs transport-types validation |
| api-020 | HIGH | tasks.controller.ts | TasksController needs A2A request/response validation |
| api-023 | CRITICAL | plan.handlers.ts | Plan handlers missing payload validation |
| api-024 | CRITICAL | build.handlers.ts | Build handlers missing payload validation |
| api-038 | MEDIUM | hitl.handlers.ts | HITL handlers missing payload validation |
| api-039 | MEDIUM | converse.handlers.ts | Converse handlers missing payload validation |

## Test Adequacy Assessment

### Current Test Coverage
- **plan.handlers.spec.ts**: EXISTS - Tests plan handler logic but NOT transport-types validation
- **converse.handlers.spec.ts**: EXISTS - Tests converse handler logic but NOT transport-types validation
- **TaskRequestDto tests**: MISSING - No validation tests exist
- **TasksController tests**: MISSING - No A2A protocol validation tests
- **Build handlers tests**: MISSING - No tests for build.handlers.ts
- **HITL handlers tests**: MISSING - No tests for hitl.handlers.ts

### Required Test Coverage

Before implementing transport-types validation, we need:

#### 1. Unit Tests for DTOs (api-008)
**File**: `apps/api/src/agent2agent/dto/task-request.dto.spec.ts`

**Test Requirements**:
- Validate ExecutionContext structure
- Validate mode-specific payload types
- Validate JSON-RPC 2.0 compliance
- Test invalid request rejection
- Test type guards (`isA2ATaskRequest`, `isExecutionContext`)

**Coverage Targets**:
- Lines: ≥85%
- Branches: ≥80%
- Functions: ≥85%

#### 2. Integration Tests for TasksController (api-020)
**File**: `apps/api/src/agent2agent/tasks/tasks.controller.spec.ts`

**Test Requirements**:
- Validate all A2A endpoint request/response formats
- Test JSON-RPC 2.0 structure validation
- Test transport-types compliance for each mode
- Test error responses follow JSON-RPC error format
- Test ExecutionContext flow through controller

**Coverage Targets**:
- Lines: ≥80%
- Branches: ≥75%
- Functions: ≥80%

#### 3. Unit Tests for Mode Handlers (api-023, api-024, api-038, api-039)
**Files**:
- `apps/api/src/agent2agent/services/base-agent-runner/plan.handlers.spec.ts` (EXISTS - needs enhancement)
- `apps/api/src/agent2agent/services/base-agent-runner/build.handlers.spec.ts` (NEW)
- `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.spec.ts` (NEW)
- `apps/api/src/agent2agent/services/base-agent-runner/converse.handlers.spec.ts` (EXISTS - needs enhancement)

**Test Requirements for Each Handler**:
- Validate payload against mode-specific types (PlanModePayload, BuildModePayload, etc.)
- Test all actions for the mode (create, read, list, edit, etc.)
- Test payload validation rejection for invalid structures
- Test response format compliance
- Test ExecutionContext preservation

**Coverage Targets**:
- Lines: ≥85%
- Branches: ≥80%
- Functions: ≥85%

## Implementation Plan

### Phase 1: Test Infrastructure (REQUIRED BEFORE FIXES)

#### Step 1.1: Create DTO Tests (api-008)
```typescript
// apps/api/src/agent2agent/dto/task-request.dto.spec.ts

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TaskRequestDto, ExecutionContextDto } from './task-request.dto';
import {
  isA2ATaskRequest,
  isExecutionContext
} from '@orchestrator-ai/transport-types';

describe('TaskRequestDto', () => {
  describe('ExecutionContext validation', () => {
    it('should validate valid ExecutionContext', async () => {
      const dto = plainToInstance(ExecutionContextDto, {
        orgSlug: 'test-org',
        userId: 'user-123',
        conversationId: 'conv-123',
        taskId: 'task-123',
        planId: '00000000-0000-0000-0000-000000000000',
        deliverableId: '00000000-0000-0000-0000-000000000000',
        agentSlug: 'context-agent',
        agentType: 'context',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022'
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(isExecutionContext(dto)).toBe(true);
    });

    it('should reject invalid ExecutionContext (missing required fields)', async () => {
      const dto = plainToInstance(ExecutionContextDto, {
        orgSlug: 'test-org',
        userId: 'user-123'
        // Missing required fields
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('A2A request validation', () => {
    it('should validate valid A2A task request', async () => {
      const request = {
        context: {
          orgSlug: 'test-org',
          userId: 'user-123',
          conversationId: 'conv-123',
          taskId: 'task-123',
          planId: '00000000-0000-0000-0000-000000000000',
          deliverableId: '00000000-0000-0000-0000-000000000000',
          agentSlug: 'context-agent',
          agentType: 'context',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
        },
        mode: 'converse',
        userMessage: 'Hello',
        payload: {}
      };

      const dto = plainToInstance(TaskRequestDto, request);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate mode-specific payloads', async () => {
      // Test PLAN mode
      // Test BUILD mode
      // Test CONVERSE mode
      // Test HITL mode
    });
  });
});
```

#### Step 1.2: Create Controller Tests (api-020)
```typescript
// apps/api/src/agent2agent/tasks/tasks.controller.spec.ts

import { Test } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskStatusService } from './task-status.service';

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: TasksService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: {
            listTasks: jest.fn(),
            getTaskById: jest.fn(),
            updateTask: jest.fn(),
            cancelTask: jest.fn()
          }
        },
        {
          provide: TaskStatusService,
          useValue: {
            getTaskStatus: jest.fn(),
            getTaskMessages: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<TasksController>(TasksController);
    tasksService = module.get<TasksService>(TasksService);
  });

  describe('A2A protocol compliance', () => {
    it('should validate A2A request format', () => {
      // Test valid A2A request
    });

    it('should return JSON-RPC 2.0 success response', () => {
      // Test response format
    });

    it('should return JSON-RPC 2.0 error response on failure', () => {
      // Test error response format
    });
  });

  describe('Transport types validation', () => {
    it('should validate ExecutionContext in all requests', () => {
      // Test ExecutionContext validation
    });

    it('should validate mode-specific payloads', () => {
      // Test PLAN, BUILD, CONVERSE, HITL payloads
    });
  });
});
```

#### Step 1.3: Create Handler Tests (api-023, api-024, api-038, api-039)
```typescript
// Example: apps/api/src/agent2agent/services/base-agent-runner/build.handlers.spec.ts

import {
  BuildModePayload,
  BuildAction
} from '@orchestrator-ai/transport-types';
import {
  handleBuildRead,
  handleBuildList,
  handleBuildEdit,
  // ... other handlers
} from './build.handlers';

describe('Build Handlers', () => {
  describe('Payload validation', () => {
    it('should validate BuildReadPayload', async () => {
      const payload: BuildReadPayload = {
        action: 'read',
        versionId: 'version-123'
      };

      // Test handler accepts valid payload
    });

    it('should reject invalid BuildReadPayload', async () => {
      const payload = {
        action: 'read',
        invalidField: 'should-fail'
      };

      // Test handler rejects invalid payload
    });
  });

  describe('All build actions', () => {
    const actions: BuildAction[] = [
      'create', 'read', 'list', 'edit', 'rerun',
      'set_current', 'delete_version', 'merge_versions',
      'copy_version', 'delete'
    ];

    actions.forEach(action => {
      it(`should validate ${action} payload`, async () => {
        // Test each action's payload validation
      });
    });
  });

  describe('Response format compliance', () => {
    it('should return TaskResponseDto format', async () => {
      // Test response structure
    });

    it('should include proper metadata', async () => {
      // Test metadata structure
    });
  });
});
```

### Phase 2: Implementation (AFTER TESTS PASS)

#### Issue api-008: TaskRequestDto Validation

**File**: `apps/api/src/agent2agent/dto/task-request.dto.ts`

**Current State**:
- DTO imports types from `@orchestrator-ai/transport-types`
- Uses class-validator for validation
- Basic structure matches transport types

**Required Changes**:
1. Add runtime validation for mode-specific payloads
2. Add custom validators for PlanModePayload, BuildModePayload, etc.
3. Add type guards to validate payload structure

**Implementation**:
```typescript
import {
  PlanModePayload,
  BuildModePayload,
  ConverseModePayload,
  HitlModePayload
} from '@orchestrator-ai/transport-types';
import { Validate, ValidationArguments } from 'class-validator';

// Custom validator for mode-specific payloads
class ModePayloadValidator {
  validate(value: any, args: ValidationArguments) {
    const request = args.object as TaskRequestDto;
    const mode = request.mode;

    if (!mode || !value) return true; // Let other validators handle missing values

    switch (mode) {
      case AgentTaskMode.PLAN:
        return this.validatePlanPayload(value);
      case AgentTaskMode.BUILD:
        return this.validateBuildPayload(value);
      case AgentTaskMode.CONVERSE:
        return this.validateConversePayload(value);
      case AgentTaskMode.HITL:
        return this.validateHitlPayload(value);
      default:
        return false;
    }
  }

  private validatePlanPayload(payload: any): boolean {
    // Validate against PlanModePayload type
    const validActions = ['create', 'read', 'list', 'edit', 'rerun',
                          'set_current', 'delete_version', 'merge_versions',
                          'copy_version', 'delete'];
    return payload.action && validActions.includes(payload.action);
  }

  private validateBuildPayload(payload: any): boolean {
    // Validate against BuildModePayload type
    const validActions = ['create', 'read', 'list', 'edit', 'rerun',
                          'set_current', 'delete_version', 'merge_versions',
                          'copy_version', 'delete'];
    return payload.action && validActions.includes(payload.action);
  }

  private validateConversePayload(payload: any): boolean {
    // ConverseModePayload has no required action field
    // Validate optional fields if present
    return true;
  }

  private validateHitlPayload(payload: any): boolean {
    // Validate against HitlModePayload type
    const validActions = ['resume', 'status', 'history', 'pending'];
    return payload.action && validActions.includes(payload.action);
  }

  defaultMessage(args: ValidationArguments) {
    const request = args.object as TaskRequestDto;
    return `Payload does not match ${request.mode} mode requirements`;
  }
}

export class TaskRequestDto {
  @IsObject()
  @ValidateNested()
  @Type(() => ExecutionContextDto)
  context!: ExecutionContext;

  @IsOptional()
  @IsEnum(AgentTaskMode)
  mode?: AgentTaskMode;

  @IsOptional()
  @IsString()
  userMessage?: string;

  @IsOptional()
  @IsObject()
  @Validate(ModePayloadValidator)  // <-- Add custom validator
  payload?: Record<string, unknown>;

  // ... rest of fields
}
```

#### Issue api-020: TasksController Validation

**File**: `apps/api/src/agent2agent/tasks/tasks.controller.ts`

**Current State**:
- Controller handles task management endpoints
- Does NOT validate A2A protocol compliance
- No transport-types validation

**Required Changes**:
1. Add request validation for A2A protocol
2. Add response formatting to ensure JSON-RPC 2.0 compliance
3. Import and use transport-types validators

**Implementation**:
```typescript
import {
  isA2ATaskRequest,
  isExecutionContext,
  A2ATaskRequest,
  A2ATaskSuccessResponse,
  A2ATaskErrorResponse
} from '@orchestrator-ai/transport-types';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {

  /**
   * Validate A2A request format
   */
  private validateA2ARequest(body: unknown): body is A2ATaskRequest {
    if (!isA2ATaskRequest(body)) {
      throw new BadRequestException('Invalid A2A request format - must be JSON-RPC 2.0');
    }

    if (!body.params || !isExecutionContext(body.params.context)) {
      throw new BadRequestException('Invalid ExecutionContext in request');
    }

    return true;
  }

  /**
   * Format success response as JSON-RPC 2.0
   */
  private formatSuccessResponse(result: unknown, requestId: string | number | null): A2ATaskSuccessResponse {
    return {
      jsonrpc: '2.0',
      id: requestId,
      result
    };
  }

  /**
   * Format error response as JSON-RPC 2.0
   */
  private formatErrorResponse(
    error: Error,
    requestId: string | number | null,
    code: number = -32000
  ): A2ATaskErrorResponse {
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code,
        message: error.message,
        data: error
      }
    };
  }

  // Apply to relevant endpoints
  // Note: TasksController handles non-A2A endpoints (task management)
  // A2A protocol is handled by agent2agent controllers
  // This validation should be added to agent execution endpoints
}
```

**Note**: TasksController is for task management, not A2A agent execution. The A2A validation should be added to:
- `apps/api/src/agent2agent/agent-execution/agent-execution.controller.ts`
- `apps/api/src/agent2agent/services/base-agent-runner.service.ts`

#### Issue api-023: Plan Handlers Validation

**File**: `apps/api/src/agent2agent/services/base-agent-runner/plan.handlers.ts`

**Current State**:
- Imports PlanModePayload types but doesn't validate at runtime
- Casts payload to `Partial<PlanXxxPayload>` without validation
- No type guards to ensure payload structure

**Required Changes**:
1. Add runtime validation for each plan action
2. Create type guards for plan payloads
3. Validate required fields before processing

**Implementation**:
```typescript
import {
  PlanModePayload,
  PlanCreatePayload,
  PlanReadPayload,
  // ... other types
} from '@orchestrator-ai/transport-types';

// Type guards for plan payloads
function isPlanCreatePayload(payload: unknown): payload is PlanCreatePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as any).action === 'create'
  );
}

function isPlanReadPayload(payload: unknown): payload is PlanReadPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as any).action === 'read'
  );
}

// ... similar guards for all plan actions

// Validate plan payload
function validatePlanPayload(payload: unknown): payload is PlanModePayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Plan payload must be an object');
  }

  const action = (payload as any).action;
  const validActions = [
    'create', 'read', 'list', 'edit', 'rerun',
    'set_current', 'delete_version', 'merge_versions',
    'copy_version', 'delete'
  ];

  if (!action || !validActions.includes(action)) {
    throw new Error(
      `Invalid plan action: ${action}. Must be one of: ${validActions.join(', ')}`
    );
  }

  return true;
}

export async function handlePlanCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  try {
    // Validate payload structure
    validatePlanPayload(request.payload);

    // Safely cast after validation
    const payload = request.payload as PlanCreatePayload;

    // Continue with handler logic...
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

// Apply to all plan handlers
```

#### Issue api-024: Build Handlers Validation

**File**: `apps/api/src/agent2agent/services/base-agent-runner/build.handlers.ts`

**Implementation**: Same pattern as plan handlers
```typescript
import {
  BuildModePayload,
  BuildCreatePayload,
  BuildReadPayload,
  // ... other types
} from '@orchestrator-ai/transport-types';

// Add type guards for each build action
function isBuildCreatePayload(payload: unknown): payload is BuildCreatePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as any).action === 'create'
  );
}

// Add validation function
function validateBuildPayload(payload: unknown): payload is BuildModePayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Build payload must be an object');
  }

  const action = (payload as any).action;
  const validActions = [
    'create', 'read', 'list', 'edit', 'rerun',
    'set_current', 'delete_version', 'merge_versions',
    'copy_version', 'delete'
  ];

  if (!action || !validActions.includes(action)) {
    throw new Error(
      `Invalid build action: ${action}. Must be one of: ${validActions.join(', ')}`
    );
  }

  return true;
}

// Apply validation to all build handlers
export async function handleBuildRead(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: BuildHandlerDependencies,
): Promise<TaskResponseDto> {
  try {
    validateBuildPayload(request.payload);
    const payload = request.payload as BuildReadPayload;
    // ... continue
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}
```

#### Issue api-038: HITL Handlers Validation

**File**: `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts`

**Implementation**:
```typescript
import {
  HitlModePayload,
  HitlResumePayload,
  HitlStatusPayload,
  HitlHistoryPayload,
  HitlPendingPayload
} from '@orchestrator-ai/transport-types';

// Type guards
function isHitlResumePayload(payload: unknown): payload is HitlResumePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as any).action === 'resume' &&
    'taskId' in payload &&
    'decision' in payload
  );
}

function validateHitlPayload(payload: unknown): payload is HitlModePayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('HITL payload must be an object');
  }

  const action = (payload as any).action;
  const validActions = ['resume', 'status', 'history', 'pending'];

  if (!action || !validActions.includes(action)) {
    throw new Error(
      `Invalid HITL action: ${action}. Must be one of: ${validActions.join(', ')}`
    );
  }

  // Validate required fields per action
  if (action === 'resume') {
    if (!('taskId' in payload) || !('decision' in payload)) {
      throw new Error('HITL resume requires taskId and decision');
    }
  }

  return true;
}

// Apply to handlers
export async function handleHitlResume(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: HitlHandlerDependencies,
): Promise<TaskResponseDto> {
  try {
    validateHitlPayload(request.payload);
    const payload = request.payload as HitlResumePayload;
    // ... continue
  } catch (error) {
    return handleError(AgentTaskMode.HITL, error);
  }
}
```

#### Issue api-039: Converse Handlers Validation

**File**: `apps/api/src/agent2agent/services/base-agent-runner/converse.handlers.ts`

**Implementation**:
```typescript
import { ConverseModePayload } from '@orchestrator-ai/transport-types';

// Converse mode has no required action field
// Validate optional fields if present
function validateConversePayload(payload: unknown): payload is ConverseModePayload {
  if (!payload) {
    return true; // Payload is optional for converse
  }

  if (typeof payload !== 'object') {
    throw new Error('Converse payload must be an object if provided');
  }

  const p = payload as any;

  // Validate optional fields
  if ('temperature' in p && typeof p.temperature !== 'number') {
    throw new Error('temperature must be a number');
  }

  if ('maxTokens' in p && typeof p.maxTokens !== 'number') {
    throw new Error('maxTokens must be a number');
  }

  if ('stop' in p && !Array.isArray(p.stop)) {
    throw new Error('stop must be an array');
  }

  return true;
}

export async function executeConverse(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: ConverseHandlerDependencies,
): Promise<TaskResponseDto> {
  try {
    validateConversePayload(request.payload);
    const payload = (request.payload ?? {}) as ConverseModePayload;
    // ... continue
  } catch (error) {
    return handleError(AgentTaskMode.CONVERSE, error);
  }
}
```

### Phase 3: Integration & Testing

1. Run all unit tests
2. Run integration tests
3. Verify coverage meets targets
4. Test with real A2A requests
5. Validate error responses

### Phase 4: Documentation

1. Update API documentation with transport-types requirements
2. Document validation errors and how to fix them
3. Update developer guide with transport-types compliance

## Error Handling

All validation errors should:
1. Return JSON-RPC 2.0 error responses
2. Include clear error messages
3. Specify which field/validation failed
4. Provide examples of correct format

**Example Error Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "request-123",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "payload.action",
      "error": "Invalid plan action: invalid. Must be one of: create, read, list, edit, rerun, set_current, delete_version, merge_versions, copy_version, delete",
      "received": "invalid",
      "expected": "One of: create, read, list, ..."
    }
  }
}
```

## Acceptance Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Test coverage meets targets (≥80% lines, ≥75% branches)
- [ ] All 6 issues resolved
- [ ] API documentation updated
- [ ] Developer guide updated
- [ ] No breaking changes to existing A2A clients

## Estimated Effort

- **Phase 1 (Tests)**: 2-3 days
- **Phase 2 (Implementation)**: 1-2 days
- **Phase 3 (Integration)**: 0.5 days
- **Phase 4 (Documentation)**: 0.5 days

**Total**: 4-6 days

## Dependencies

- `@orchestrator-ai/transport-types` package must be stable
- No breaking changes to transport-types during implementation
- Frontend must be ready to handle validation errors

## Risks

1. **Breaking Changes**: Strict validation may reject previously accepted requests
   - Mitigation: Add feature flag for gradual rollout

2. **Performance Impact**: Runtime validation adds overhead
   - Mitigation: Benchmark validation performance, optimize if needed

3. **Type Complexity**: Mode payloads are union types, can be complex to validate
   - Mitigation: Use discriminated unions (action field) for type narrowing

## Next Steps

1. **Get approval** for test infrastructure requirements
2. **Allocate time** for test creation (2-3 days)
3. **Create tests** following Phase 1 plan
4. **Wait for tests to pass** before implementing fixes
5. **Implement fixes** following Phase 2 plan
6. **Integrate and test** following Phase 3 plan
7. **Update documentation** following Phase 4 plan

## Related Documents

- [Transport Types Skill](../../.claude/skills/transport-types-skill/skill.md)
- [API Architecture Skill](../../.claude/skills/api-architecture-skill/skill.md)
- [A2A Compliance Evaluation](../a2a-compliance-evaluation.md)
- [Monitoring Report](../../.monitor/apps-api.json)
