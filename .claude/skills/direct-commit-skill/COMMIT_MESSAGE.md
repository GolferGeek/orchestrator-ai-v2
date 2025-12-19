# Commit Message Generation

**Always generate commit messages automatically** by analyzing the git diff. Only use a provided message if the user explicitly provides one.

## Process

1. **Get git diff:**
   ```bash
   git diff --staged  # For staged changes
   git diff           # For unstaged changes
   git diff HEAD      # For all changes (staged + unstaged)
   git diff HEAD -- <path>  # For specific file paths
   git status         # To see what files changed
   ```
   
   **IMPORTANT:** These `git diff` commands **NEVER require approval** - they are read-only operations essential for commit message generation.

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

## Commit Message Types

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

## Scope Detection

Determine scope from file paths:
- `apps/api/` → `api`
- `apps/web/` → `web`
- `apps/langgraph/` → `langgraph`
- `apps/transport-types/` → `transport-types`
- `.claude/` → `claude` or `tooling`
- Root config files → `config` or `build`

## Examples

**Analyzing changes:**
- New file: `apps/api/src/services/validation.service.ts` with validation logic
  → `feat(api): add validation service`

- Modified: `apps/web/src/stores/executionContextStore.ts` - fixed update bug
  → `fix(web): resolve execution context store update issue`

- Refactored: `apps/langgraph/src/agents/marketing/graph.ts` - improved state management
  → `refactor(langgraph): improve marketing agent state management`

- Multiple files: Changes across API and web for execution context
  → `feat(api,web): integrate execution context throughout system`

## Message Quality

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

## User-Provided Messages

If user provides a message (e.g., `/commit "my message"`):
- Use the provided message exactly as given
- Still run quality gates and safety review
- Don't override user's message

## Multi-Scope Messages

If changes span multiple scopes:
- Use comma-separated scopes: `feat(api,web): add feature`
- Or use the primary scope if one dominates
- Or use `core` if changes are in shared/root code

