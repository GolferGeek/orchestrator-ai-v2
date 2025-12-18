# Safety Review

Perform a quick review of changed files to catch obvious issues before committing.

## Progressive Review Strategy

**Only check what's relevant to changed files:**
- If execution context files changed → invoke execution-context-skill (when available)
- If transport type files changed → invoke transport-types-skill (when available)
- If API files changed → check API patterns
- If front-end files changed → check front-end patterns

## Check Categories

### Execution Context Violations

**If `apps/transport-types/core/execution-context.ts` or related files changed:**

Check for:
- Is execution context being passed correctly?
- Is execution context being modified incorrectly?
- Are required fields present?

**Examples:**

```typescript
// ❌ BAD - Execution context not passed
async function processTask(userId: string, taskId: string) {
  // Missing execution context
}

// ✅ GOOD - Execution context passed
async function processTask(context: ExecutionContext, taskId: string) {
  // Has full context
}
```

### Transport Types Violations

**If transport type files changed:**

Check for:
- Are custom fields being added?
- Is shape-hopping happening?
- Is A2A compliance maintained?

**Examples:**

```typescript
// ❌ BAD - Custom field added
interface TaskRequest {
  customField: string; // Not in transport types
}

// ✅ GOOD - Uses transport types
import { TaskRequestDto } from '@orchestrator-ai/transport-types';
```

### Architecture Violations

**Based on file location:**

**Front-end files:**
- Three-layer architecture followed? (store/service/component)
- API calls in service layer, not components?
- Proper state management?

```typescript
// ❌ BAD - API call in component
export default defineComponent({
  async mounted() {
    const response = await fetch('/api/endpoint'); // Should be in service
  }
});

// ✅ GOOD - Service handles API
export default defineComponent({
  async mounted() {
    const data = await myService.getData(); // Service handles API
  }
});
```

**Back-end files:**
- Module/service/controller separation?
- Proper dependency injection?
- File naming: kebab-case?

### Code Quality Issues

Check for:
- Missing error handling
- Type safety issues (excessive `any` types)
- Missing imports
- Unused code
- Security concerns

## Tools Used

- **Read**: Read changed files to understand modifications
- **Grep**: Search for patterns (execution context usage, transport types, etc.)
- **Glob**: Find related files by pattern
- **Bash**: Run git commands to see what changed

## Reporting Issues

If safety review finds issues:
- Report them clearly with file paths and line numbers
- Suggest fixes
- **DO NOT commit** if critical issues found
- Allow user to review and decide

