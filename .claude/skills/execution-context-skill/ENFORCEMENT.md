# Execution Context Enforcement Strategy

This document outlines how to enforce the ExecutionContext capsule pattern throughout the codebase.

## Enforcement Levels

### Level 1: Code Review (Manual)

**When:** During PR review, before code is merged

**How:**
1. Review all function signatures for individual `userId`, `conversationId`, `taskId` parameters
2. Check for destructuring of ExecutionContext before passing to services
3. Verify all LLM calls include ExecutionContext
4. Verify all observability calls include full context
5. Check LangGraph invocations include full context in input

**Tools:**
- Manual code review
- Grep searches for common patterns
- This skill's violation detection

### Level 2: Linting Rules (Automated)

**When:** During development, before commit

**How:**
1. Create ESLint rules to detect common violations
2. Warn on function signatures taking individual context fields
3. Warn on destructuring ExecutionContext before passing
4. Warn on observability calls missing context

**Example ESLint Rule:**
```javascript
// .eslintrc.js
rules: {
  'no-individual-context-params': 'error', // Custom rule
  'no-context-destructuring': 'warn', // Custom rule
}
```

**Implementation:**
- Custom ESLint plugin (future enhancement)
- For now, use grep patterns in pre-commit hook

### Level 3: TypeScript Types (Compile-Time)

**When:** During TypeScript compilation

**How:**
1. Use TypeScript's type system to enforce ExecutionContext
2. Make ExecutionContext required in service interfaces
3. Use branded types to prevent passing individual fields

**Example:**
```typescript
// Type-safe ExecutionContext
type ExecutionContext = {
  readonly orgSlug: string;
  readonly userId: string;
  // ... other fields
} & { readonly __brand: 'ExecutionContext' };

// Function that requires context
function createTask(context: ExecutionContext, dto: CreateTaskDto): Promise<Task> {
  // TypeScript will error if individual fields are passed
}
```

### Level 4: Runtime Validation (Testing)

**When:** During test execution

**How:**
1. Add runtime validation in test helpers
2. Verify ExecutionContext is passed to all service calls
3. Check observability events include full context
4. Validate LangGraph receives full context

**Example Test Helper:**
```typescript
// test-helpers/execution-context.ts
export function assertExecutionContext(context: unknown): asserts context is ExecutionContext {
  if (!isExecutionContext(context)) {
    throw new Error('Invalid ExecutionContext: missing required fields');
  }
}

// In tests
it('should pass ExecutionContext to service', async () => {
  const context = createMockExecutionContext();
  await service.createTask(context, dto);
  
  // Verify service received full context
  expect(mockService.createTask).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: context.userId,
      conversationId: context.conversationId,
      taskId: context.taskId,
      // ... all fields
    }),
    dto,
  );
});
```

## Detection Strategies

### Strategy 1: Grep Patterns

**Pattern 1: Individual Parameters**
```bash
# Find functions taking userId, conversationId, taskId as separate params
grep -r "userId: string.*conversationId: string" apps/api/src
grep -r "conversationId: string.*taskId: string" apps/api/src
```

**Pattern 2: Destructuring Before Passing**
```bash
# Find destructuring of context
grep -r "const { userId, conversationId" apps/api/src
grep -r "const userId = context.userId" apps/api/src
```

**Pattern 3: Missing Context in Calls**
```bash
# Find LLM calls without context
grep -r "llmService.generateResponse" apps/api/src | grep -v "context"
grep -r "observability.logEvent" apps/api/src | grep -v "context"
```

### Strategy 2: Code Analysis

**Analyze Function Signatures:**
1. Find all functions in `apps/api/src` that take `userId`, `conversationId`, or `taskId` as parameters
2. Check if they should take `ExecutionContext` instead
3. Identify call sites that need updating

**Analyze Service Calls:**
1. Find all calls to `llmService.generateResponse()`
2. Verify they include `ExecutionContext` as first parameter
3. Find all calls to `observabilityService.logEvent()`
4. Verify they include `ExecutionContext` as first parameter

### Strategy 3: Test Coverage

**Add Tests for Context Propagation:**
1. Test that ExecutionContext flows through all layers
2. Test that services receive full context
3. Test that observability events include full context
4. Test that LangGraph receives full context

## Fix Workflow

### Step 1: Identify Violations

1. Run grep patterns to find potential violations
2. Review function signatures in target files
3. Check service calls for missing context
4. Document all violations found

### Step 2: Prioritize Fixes

**High Priority:**
- LLM service calls missing context (breaks observability)
- Observability calls missing context (breaks tracking)
- Service methods taking individual fields (prevents future context needs)

**Medium Priority:**
- Helper functions extracting fields
- Controllers destructuring context
- LangGraph invocations missing context

**Low Priority:**
- Test code (can be updated gradually)
- Legacy code (update during refactoring)

### Step 3: Fix Violations

1. Update function signature to take `ExecutionContext`
2. Update function body to use `context.fieldName`
3. Update all callers to pass `context`
4. Run tests to verify fix
5. Update related code (observability, logging)

### Step 4: Verify Fix

1. Run linting to catch any remaining issues
2. Run tests to ensure functionality preserved
3. Review code to ensure pattern is consistent
4. Document the fix in commit message

## Integration with Quality Gates

This skill integrates with:
- **Quality Gates Skill**: Run ExecutionContext checks as part of PR review
- **Direct Commit Skill**: Check for violations before committing
- **Codebase Hardening**: Systematic audit of all violations

## Automated Detection Script

**Future Enhancement:** Create a script to automatically detect violations:

```bash
#!/bin/bash
# scripts/check-execution-context-violations.sh

echo "Checking for ExecutionContext violations..."

# Find functions with individual context parameters
echo "1. Functions with individual context parameters:"
grep -rn "userId: string.*conversationId: string" apps/api/src || echo "  None found"

# Find context destructuring
echo "2. Context destructuring:"
grep -rn "const { userId, conversationId" apps/api/src || echo "  None found"

# Find LLM calls without context
echo "3. LLM calls missing context:"
grep -rn "llmService.generateResponse" apps/api/src | grep -v "context" || echo "  None found"

# Find observability calls without context
echo "4. Observability calls missing context:"
grep -rn "observability.logEvent\|observability.emitEvent" apps/api/src | grep -v "context" || echo "  None found"

echo "Done."
```

## Metrics

Track enforcement effectiveness:
- **Violations Found**: Number of violations detected per review
- **Violations Fixed**: Number of violations fixed per sprint
- **Coverage**: Percentage of code following the pattern
- **Observability Completeness**: Percentage of events with full context

## Continuous Improvement

1. **Add New Patterns**: As new violation patterns are discovered, add them to detection
2. **Improve Rules**: Refine ESLint rules based on false positives/negatives
3. **Update Documentation**: Keep violation examples up to date
4. **Share Learnings**: Document common mistakes to prevent future violations

