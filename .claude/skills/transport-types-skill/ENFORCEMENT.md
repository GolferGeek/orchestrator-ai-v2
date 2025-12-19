# Transport Types Enforcement Strategy

This document outlines how to enforce A2A protocol compliance and transport type contracts throughout the codebase.

## Enforcement Levels

### Level 1: TypeScript Compile-Time (Primary)

**When:** During TypeScript compilation

**How:**
1. **Import transport types** - Always use types from `@orchestrator-ai/transport-types`
2. **Type annotations** - Use transport types in function signatures
3. **Type checking** - TypeScript will catch mismatches at compile time

**Example:**
```typescript
import { A2ATaskRequest, PlanCreatePayload } from '@orchestrator-ai/transport-types';

// TypeScript will error if structure is wrong
function handlePlanCreate(request: A2ATaskRequest): Promise<A2ATaskSuccessResponse> {
  const payload = request.params.payload as PlanCreatePayload;
  // TypeScript ensures payload matches PlanCreatePayload structure
}
```

**Effectiveness:** High - Catches most violations at compile time

### Level 2: Runtime Validation (API Boundaries)

**When:** At API entry points (controllers, handlers)

**How:**
1. **Validate JSON-RPC structure** - Check `jsonrpc: "2.0"`, `method`, `id`, `params`
2. **Validate ExecutionContext** - Ensure context is present and valid
3. **Validate payload structure** - Check action matches mode, required fields present
4. **Use type guards** - Leverage `isA2ATaskRequest()`, `isExecutionContext()` from transport types

**Example:**
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

**Effectiveness:** High - Catches violations at runtime before processing

### Level 3: Code Review (Manual)

**When:** During PR review, before code is merged

**How:**
1. **Review all agent endpoints** - Check they use transport types
2. **Check payload structures** - Verify no custom fields added
3. **Verify JSON-RPC format** - Ensure proper structure
4. **Check mode/action combinations** - Verify correct actions for each mode
5. **Review transport type changes** - Ensure coordinated with frontend/backend

**Checklist:**
- [ ] All A2A endpoints use `A2ATaskRequest` / `A2ATaskResponse`
- [ ] All payloads use types from `@orchestrator-ai/transport-types`
- [ ] No custom fields added to payloads
- [ ] All required fields present (context, mode, payload, userMessage)
- [ ] JSON-RPC structure correct (`jsonrpc: "2.0"`, proper error format)
- [ ] Mode/action combinations correct (plan actions for plan mode, etc.)
- [ ] Transport type changes coordinated with frontend/backend

**Effectiveness:** Medium - Relies on reviewer knowledge

### Level 4: Automated Testing

**When:** During test execution

**How:**
1. **Unit tests** - Test request/response validation
2. **Integration tests** - Test full A2A request/response flow
3. **Type tests** - Verify TypeScript types are correct
4. **Contract tests** - Verify transport types match between frontend/backend

**Example:**
```typescript
describe('A2A Request Validation', () => {
  it('should reject request without ExecutionContext', () => {
    const request = {
      jsonrpc: '2.0',
      method: 'plan',
      id: 'test-id',
      params: {
        mode: 'plan',
        payload: { action: 'create' },
        userMessage: '',
        // Missing context!
      },
    };

    expect(() => validateA2ARequest(request)).toThrow('ExecutionContext is required');
  });

  it('should accept valid A2A request', () => {
    const request: A2ATaskRequest = {
      jsonrpc: '2.0',
      method: 'plan',
      id: 'test-id',
      params: {
        context: createMockExecutionContext(),
        mode: AgentTaskMode.PLAN,
        payload: { action: 'create' },
        userMessage: '',
      },
    };

    expect(validateA2ARequest(request)).toBe(true);
  });
});
```

**Effectiveness:** High - Catches violations in test environment

## Detection Strategies

### Strategy 1: Grep Patterns

**Pattern 1: Custom Fields in Payloads**
```bash
# Find payloads with custom fields (not in transport types)
grep -r "payload.*customField\|payload.*myField" apps/api/src
grep -r "payload:.*{" apps/api/src | grep -v "from '@orchestrator-ai/transport-types'"
```

**Pattern 2: Missing Transport Type Imports**
```bash
# Find files using A2A endpoints without importing transport types
grep -r "agent-to-agent.*tasks" apps/api/src | grep -v "from '@orchestrator-ai/transport-types'"
```

**Pattern 3: Wrong JSON-RPC Structure**
```bash
# Find responses not using JSON-RPC format
grep -r "jsonrpc.*2.0" apps/api/src | grep -v "jsonrpc: '2.0'"
grep -r "return.*{.*status.*success" apps/api/src | grep -v "jsonrpc"
```

### Strategy 2: TypeScript Compiler Checks

**Enable Strict Type Checking:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Use Type Guards:**
```typescript
// Create type guard functions
function isValidPlanPayload(payload: unknown): payload is PlanModePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'action' in payload &&
    typeof (payload as any).action === 'string'
  );
}
```

### Strategy 3: Linting Rules

**Future Enhancement:** Create ESLint rules to detect:
- Missing transport type imports
- Custom fields in payloads
- Wrong JSON-RPC structure
- Missing required fields

## Fix Workflow

### Step 1: Identify Violations

1. Run grep patterns to find potential violations
2. Review TypeScript compiler errors
3. Check test failures
4. Review code for custom fields or wrong structures

### Step 2: Prioritize Fixes

**High Priority:**
- Missing ExecutionContext in requests (breaks observability)
- Wrong JSON-RPC structure (breaks A2A protocol)
- Custom fields in payloads (breaks contract)

**Medium Priority:**
- Missing optional fields (may cause issues)
- Wrong mode/action combinations (runtime errors)
- Type assertions without validation (potential runtime errors)

**Low Priority:**
- Code style issues
- Documentation updates

### Step 3: Fix Violations

1. **Import transport types** - Add imports from `@orchestrator-ai/transport-types`
2. **Update types** - Use transport types in function signatures
3. **Remove custom fields** - Remove any fields not in transport types
4. **Add validation** - Add runtime validation at API boundaries
5. **Update tests** - Ensure tests use correct transport types

### Step 4: Verify Fix

1. **TypeScript compilation** - Ensure no type errors
2. **Run tests** - Verify all tests pass
3. **Manual testing** - Test A2A endpoints manually
4. **Code review** - Have another developer review the fix

## Integration with Quality Gates

This skill integrates with:
- **Quality Gates Skill**: Run transport type checks as part of PR review
- **Direct Commit Skill**: Validate transport types before committing
- **Codebase Hardening**: Systematic audit of all transport type violations
- **Execution Context Skill**: Ensures ExecutionContext is included in all A2A requests

## Automated Detection Script

**Future Enhancement:** Create a script to automatically detect violations:

```bash
#!/bin/bash
# scripts/check-transport-types-violations.sh

echo "Checking for transport type violations..."

# Find files using A2A endpoints
echo "1. Files using A2A endpoints:"
grep -rn "agent-to-agent.*tasks" apps/api/src apps/web/src

# Find payloads without transport type imports
echo "2. Payloads without transport type imports:"
grep -rn "payload.*{" apps/api/src apps/web/src | grep -v "from '@orchestrator-ai/transport-types'"

# Find custom fields in payloads
echo "3. Potential custom fields:"
grep -rn "payload.*customField\|payload.*myField" apps/api/src apps/web/src

# Find wrong JSON-RPC structure
echo "4. Wrong JSON-RPC structure:"
grep -rn "jsonrpc.*[^']2.0[^']" apps/api/src apps/web/src

echo "Done."
```

## Metrics

Track enforcement effectiveness:
- **Violations Found**: Number of violations detected per review
- **Violations Fixed**: Number of violations fixed per sprint
- **Type Safety**: Percentage of A2A endpoints using transport types
- **Test Coverage**: Percentage of A2A endpoints with validation tests

## Continuous Improvement

1. **Add New Patterns**: As new violation patterns are discovered, add them to detection
2. **Improve Type Guards**: Enhance type guard functions for better validation
3. **Update Documentation**: Keep violation examples up to date
4. **Share Learnings**: Document common mistakes to prevent future violations

