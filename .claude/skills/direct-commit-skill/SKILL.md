---
name: Direct Commit
description: Commit changes directly to current branch after quality checks (lint, build, safety review). Use when user wants to commit without creating a PR, or when user mentions committing, committing changes, or direct commit.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, List
---

**Tool Permissions:**
- **Read**: Read changed files to analyze changes and generate commit messages
- **Write**: Write formatted code (if format command modifies files)
- **Edit**: Edit files if needed during safety review fixes
- **Bash**: Run git commands (status, diff, add, commit, push), npm commands (format, lint, build)
- **Grep**: Search files for patterns during safety review
- **Glob**: Find files by pattern for analysis
- **List**: List directories to understand project structure

**All tools are granted automatically** - no permission prompts needed when this skill is active.

# Direct Commit Skill

Commit changes directly to the current branch after running quality gates and safety checks. This is for the architect's workflow - bypasses PR process but still ensures code quality.

## When to Use This Skill

Use this skill when:
- User wants to commit changes directly to current branch
- User mentions "commit", "commit these changes", "commit and push"
- User wants to bypass PR workflow
- User is working as the architect (direct commits allowed)

**Do NOT use this skill when:**
- User explicitly wants to create a PR
- User mentions "pull request" or "PR"
- User is an intern (should use PR workflow)

## Quality Gates

Before committing, **ALWAYS** run these checks:

### 1. Format Code
```bash
npm run format
```

### 2. Lint Code
```bash
npm run lint
```
**Must pass with no errors** - if lint fails, fix issues before committing.

### 3. Build
```bash
npm run build
```
**Must pass** - if build fails, fix issues before committing.

### 4. Safety Review

Perform a quick review of changed files to catch obvious issues:

**Check for:**
- Execution context violations (if execution context files touched)
  - Is execution context being passed correctly?
  - Is execution context being modified incorrectly?
  - Are required fields present?
- Transport type violations (if transport type files touched)
  - Are custom fields being added?
  - Is shape-hopping happening?
  - Is A2A compliance maintained?
- Architecture violations (based on file location)
  - Front-end: Three-layer architecture followed?
  - Back-end: Module/service/controller separation?
  - File naming: kebab-case?
- Obvious code issues
  - Missing error handling
  - Type safety issues (excessive `any` types)
  - Missing imports

**Progressive Review:**
- Only check what's relevant to changed files
- If execution context files changed → invoke execution-context-skill (when available)
- If transport type files changed → invoke transport-types-skill (when available)
- If API files changed → check API patterns
- If front-end files changed → check front-end patterns

## Tool Usage

This skill uses the following tools for each operation:

### Git Operations (Bash)
- `git status` - Check what files have changed
- `git diff` / `git diff --staged` - View changes for commit message generation
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit with generated or provided message
- `git push` - Push to remote (for `/commit-push`)

### Quality Gates (Bash)
- `npm run format` - Format code (may modify files, uses Write tool)
- `npm run lint` - Lint code (must pass)
- `npm run build` - Build code (must pass)

### Analysis Operations
- **Read**: Read changed files to understand modifications
- **Grep**: Search for patterns (execution context usage, transport types, etc.)
- **Glob**: Find related files by pattern
- **List**: List directory structure to understand project layout

### File Operations
- **Write**: Write formatted code if format command modifies files
- **Edit**: Edit files if safety review finds fixable issues (optional)

## Workflow

### For `/commit` (commit only):

1. **Check git status** (Bash)
   ```bash
   git status
   ```
   - Verify there are changes to commit
   - Show what will be committed

2. **Run quality gates** (Bash)
   - Format: `npm run format` (may use Write tool)
   - Lint: `npm run lint` (must pass)
   - Build: `npm run build` (must pass)

3. **Safety review** (Read, Grep, Glob, List)
   - Use Read to analyze changed files
   - Use Grep to search for patterns
   - Use Glob to find related files
   - Use List to understand project structure
   - Check for obvious violations
   - Report any issues found

4. **If all checks pass:**
   - Stage files: `git add .` (Bash)
   - **Generate commit message** (Read, Bash):
     - Get git diff: `git diff --staged` (or `git diff` if nothing staged) (Bash)
     - Read key changed files to understand the changes (Read)
     - Determine type (feat, fix, refactor, etc.) from the nature of changes
     - Determine scope (api, web, langgraph, etc.) from file paths
     - Write clear description of what changed
     - Format: `type(scope): description`
   - **OR use provided message** if user explicitly provided one
   - Commit: `git commit -m "<generated-or-provided-message>"` (Bash)

5. **If checks fail:**
   - Report failures
   - Do NOT commit
   - Suggest fixes

### For `/commit-push` (commit and push):

Same as `/commit`, but after successful commit:

6. **Push to current branch**
   ```bash
   git push
   ```
   - Push to origin/current-branch
   - Handle any push errors

## Commit Message Generation

**Always generate commit messages automatically** by analyzing the git diff. Only use a provided message if the user explicitly provides one.

### Process

1. **Get git diff:**
   ```bash
   git diff --staged  # For staged changes
   git diff           # For unstaged changes
   git status         # To see what files changed
   ```

2. **Analyze changes:**
   - Read changed files to understand what was modified
   - Determine the type of change (feat, fix, refactor, etc.)
   - Identify the scope (api, web, langgraph, transport-types, etc.)
   - Summarize what changed in a clear description

3. **Generate message:**
   - Format: `type(scope): description`
   - Keep description under 72 characters
   - Use present tense ("add" not "added")
   - Be specific about what changed

### Commit Message Types

**Types:**
- `feat` - New feature, functionality, or capability
- `fix` - Bug fix or error correction
- `docs` - Documentation changes only
- `style` - Formatting, whitespace, missing semicolons (no code change)
- `refactor` - Code restructuring without changing functionality
- `test` - Adding or modifying tests
- `chore` - Maintenance tasks, dependencies, build config
- `perf` - Performance improvements
- `ci` - CI/CD changes

### Scope Detection

Determine scope from file paths:
- `apps/api/` → `api`
- `apps/web/` → `web`
- `apps/langgraph/` → `langgraph`
- `apps/transport-types/` → `transport-types`
- `.claude/` → `claude` or `tooling`
- Root config files → `config` or `build`

### Examples

**Analyzing changes:**
- New file: `apps/api/src/services/validation.service.ts` with validation logic
  → `feat(api): add validation service`

- Modified: `apps/web/src/stores/executionContextStore.ts` - fixed update bug
  → `fix(web): resolve execution context store update issue`

- Refactored: `apps/langgraph/src/agents/marketing/graph.ts` - improved state management
  → `refactor(langgraph): improve marketing agent state management`

- Multiple files: Changes across API and web for execution context
  → `feat(api,web): integrate execution context throughout system`

### Message Quality

**Good messages:**
- `feat(api): add execution context validation middleware`
- `fix(web): resolve execution context store immutability issue`
- `refactor(langgraph): improve state management in marketing agent`
- `docs(claude): add cursor integration reference guide`

**Bad messages:**
- `update files` (too vague)
- `fix bug` (not specific)
- `changes` (no type/scope)
- `feat: stuff` (no scope, vague description)

### User-Provided Messages

If user provides a message (e.g., `/commit "my message"`):
- Use the provided message exactly as given
- Still run quality gates and safety review
- Don't override user's message

### Multi-Scope Messages

If changes span multiple scopes:
- Use comma-separated scopes: `feat(api,web): add feature`
- Or use the primary scope if one dominates
- Or use `core` if changes are in shared/root code

## Safety Check Examples

### Execution Context Check

**If `apps/transport-types/core/execution-context.ts` or related files changed:**

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

### Transport Types Check

**If transport type files changed:**

```typescript
// ❌ BAD - Custom field added
interface TaskRequest {
  customField: string; // Not in transport types
}

// ✅ GOOD - Uses transport types
import { TaskRequestDto } from '@orchestrator-ai/transport-types';
```

### Architecture Check

**Front-end files:**
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

## Error Handling

### Lint Fails
```
❌ Lint check failed. Please fix lint errors before committing.

Errors:
- apps/api/src/service.ts:5 - Unused import
- apps/web/src/component.vue:12 - Missing type annotation

Run: npm run lint -- --fix
```

### Build Fails
```
❌ Build check failed. Please fix build errors before committing.

Errors:
- TypeScript compilation errors in apps/api/src/service.ts

Fix build errors and try again.
```

### Safety Issues Found
```
⚠️ Safety review found potential issues:

- Execution context not passed in apps/api/src/handler.ts:45
- Transport type violation in apps/web/src/service.ts:23

Review these issues. Commit anyway? (Use --force to override)
```

## Examples

### Example 1: Simple Commit (Auto-Generated Message)

User: "Commit these changes"

You would:
1. Check git status: `git status`
2. Get git diff: `git diff` (or `git diff --staged`)
3. Analyze changes:
   - Read changed files to understand modifications
   - See new file: `apps/api/src/services/validation.service.ts`
   - Determine: This is a new feature (feat), in API scope
   - Generate: `feat(api): add validation service`
4. Run `npm run format`
5. Run `npm run lint` (must pass)
6. Run `npm run build` (must pass)
7. Quick safety review
8. Stage: `git add .`
9. Commit: `git commit -m "feat(api): add validation service"`

### Example 2: Commit with Custom Message

User: "Commit with message 'fix: resolve bug'"

You would:
1. Run quality gates
2. Safety review
3. Use provided message: `git commit -m "fix: resolve bug"`
   - Note: User provided message, so use it exactly as given

### Example 3: Commit and Push (Auto-Generated Message)

User: "Commit and push"

You would:
1. Get git diff and analyze changes
2. Generate commit message from changes
3. Run quality gates
4. Safety review
5. Commit: `git commit -m "<generated-message>"`
6. Push: `git push`

## Related Skills

- `execution-context-skill/` - For execution context validation (when available)
- `transport-types-skill/` - For A2A compliance checks (when available)
- `quality-gates-skill/` - For quality gate patterns

## Notes

- This skill is for the architect's direct commit workflow
- Interns should use PR workflow (`/create-pr` command)
- Always run quality gates before committing
- Progressive safety checks - only check what's relevant
- Fail fast - don't commit if checks fail

