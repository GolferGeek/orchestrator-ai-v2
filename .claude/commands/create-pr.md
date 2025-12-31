---
description: "Create pull request with progressive validation. Analyzes changed files, runs quality checks, and creates PR if all checks pass."
argument-hint: "[base branch] [title] [description] - Base branch defaults to main/master, title auto-generated from changes if not provided"
category: "pr-workflow"
uses-skills: ["execution-context-skill", "transport-types-skill", "web-architecture-skill", "api-architecture-skill", "langgraph-architecture-skill", "quality-gates-skill", "self-reporting-skill"]
uses-agents: ["web-architecture-agent", "api-architecture-agent", "langgraph-architecture-agent", "pr-review-agent"]
related-commands: ["review-pr", "approve-pr"]
---

# /create-pr Command

## Purpose

Create a pull request with progressive validation. This command completes the PR workflow by creating PRs after validating changes through architecture skills and quality gates.

**PR Workflow:**
- `/create-pr` - Create PR with validation
- `/review-pr` - Review PR systematically
- `/approve-pr` - Approve PR quickly

## Usage

```
/create-pr [base branch] [title] [description]
```

**Arguments:**
- `base branch` (optional): Target branch for PR (default: `main` or `master`)
- `title` (optional): PR title (auto-generated from changes if not provided)
- `description` (optional): PR description (auto-generated if not provided)

## Examples

```
/create-pr
# Creates PR to main/master with auto-generated title and description

/create-pr develop
# Creates PR to develop branch

/create-pr main "feat(api): add user service"
# Creates PR to main with custom title

/create-pr main "feat(api): add user service" "Adds user service with CRUD operations"
# Creates PR with custom title and description
```

## Workflow

### 1. Analyze Changed Files

**Detect Changes:**
- Use `git diff` to identify changed files
- Classify files by domain (web, API, LangGraph)
- Identify affected areas

**File Classification:**
- Web files: `apps/web/src/**/*`
- API files: `apps/api/src/**/*`
- LangGraph files: `apps/langgraph/src/**/*`
- Execution context files: `apps/web/src/stores/execution-context.store.ts`, `apps/api/src/execution-context/**/*`
- Transport type files: `apps/transport-types/**/*`

### 2. Progressive Skill Invocation

**Invoke Skills Based on Changed Files:**

**If execution context files changed:**
- Load `execution-context-skill`
- Validate ExecutionContext flow
- Check for violations
- Stop if critical violations found

**If transport type files changed:**
- Load `transport-types-skill`
- Validate A2A protocol compliance
- Check transport type contracts
- Stop if critical violations found

**If web files changed:**
- Load `web-architecture-skill`
- Classify files (component, store, service, etc.)
- Validate against web patterns
- Check three-layer architecture
- Stop if critical violations found

**If API files changed:**
- Load `api-architecture-skill`
- Classify files (controller, service, module, runner, etc.)
- Validate against API patterns
- Check NestJS patterns
- Stop if critical violations found

**If LangGraph files changed:**
- Load `langgraph-architecture-skill`
- Classify files (workflow, node, tool, etc.)
- Validate against LangGraph patterns
- Check workflow structure
- Stop if critical violations found

### 3. Run Quality Gates

**All quality gates must pass before PR creation:**

1. **Format Code**
   ```bash
   npm run format
   ```
   - Formats code using Prettier
   - Must succeed

2. **Lint Code**
   ```bash
   npm run lint
   ```
   - Lints code using ESLint
   - Must pass (no errors)

3. **Build Code**
   ```bash
   npm run build
   ```
   - Builds all apps
   - Must succeed

4. **Run Tests**
   ```bash
   npm test
   ```
   - Runs all tests
   - Must pass (or use `/test` command)

**If any check fails:**
- PR creation is blocked
- Error message displayed
- User must fix issues before retrying

### 4. Generate PR Details

**Auto-Generate Title (if not provided):**
- Analyze changed files
- Determine change type (feat, fix, refactor, etc.)
- Determine scope (web, api, langgraph)
- Generate title: `feat(scope): description`

**Auto-Generate Description (if not provided):**
- Summary of changed files
- Architecture validation results
- Test results
- Quality gate status
- Conventional commit format

**Example Auto-Generated Description:**
```markdown
## Changes

- Added user service with CRUD operations
- Updated user controller to use new service
- Added user module

## Architecture Validation

✅ ExecutionContext: Passed
✅ Transport Types: Passed
✅ API Architecture: Passed

## Quality Gates

✅ Format: Passed
✅ Lint: Passed
✅ Build: Passed
✅ Tests: Passed

## Files Changed

- apps/api/src/user/user.service.ts
- apps/api/src/user/user.controller.ts
- apps/api/src/user/user.module.ts
```

### 5. Create PR

**Use GitHub CLI:**
```bash
gh pr create \
  --base <base-branch> \
  --title "<title>" \
  --body "<description>" \
  --label "enhancement" # if applicable
```

**PR Creation:**
- Set base branch (default: main/master)
- Set title (auto-generated or provided)
- Set description (auto-generated or provided)
- Add labels if applicable
- Link to related issues if mentioned in description

### 6. Report Results

**Success:**
```
✅ PR Created Successfully

PR: #123 - feat(api): add user service
URL: https://github.com/org/repo/pull/123
Base: main
Status: Open

Validation Summary:
✅ ExecutionContext: Passed
✅ Transport Types: Passed
✅ API Architecture: Passed
✅ Quality Gates: All Passed
```

**Failure:**
```
❌ PR Creation Blocked

Reason: Lint errors found

Errors:
- apps/api/src/user/user.service.ts:5:10 - 'any' type not allowed

Please fix errors and try again.
```

## Progressive Validation Details

### ExecutionContext Validation

**Checks:**
- ExecutionContext is received, not created
- ExecutionContext is passed whole, not cherry-picked
- ExecutionContext flows correctly through files
- No ExecutionContext violations found

**If violations found:**
- Stop PR creation
- Display violations
- Reference `execution-context-skill` for fixes

### Transport Types Validation

**Checks:**
- A2A calls use JSON-RPC 2.0 format
- Transport types match mode (plan, build, converse, hitl)
- Request/response contracts followed
- `.well-known/agent.json` discovery implemented (if applicable)

**If violations found:**
- Stop PR creation
- Display violations
- Reference `transport-types-skill` for fixes

### Architecture Validation

**Web Architecture:**
- Three-layer architecture followed
- Components use stores/services correctly
- File naming conventions (kebab-case)
- Vue 3 Composition API patterns

**API Architecture:**
- NestJS module/service/controller separation
- Controllers are thin (delegate to services)
- Services contain business logic
- File naming conventions (kebab-case)
- Runner patterns followed (if applicable)

**LangGraph Architecture:**
- StateGraph structure correct
- Nodes follow patterns
- Edges have proper conditions
- Checkpointing configured
- HITL patterns followed (if applicable)

**If violations found:**
- Stop PR creation (critical violations)
- Or add warnings to PR description (minor violations)
- Reference appropriate architecture skill for fixes

## Error Handling

### No Changes Detected
```
❌ No changes detected

Please make changes before creating a PR.
```

### Quality Gate Failure
```
❌ Quality gate failed: Lint

Errors found:
- apps/api/src/user/user.service.ts:5:10 - 'any' type not allowed

Please fix errors and try again.
```

### Architecture Violation
```
❌ Architecture violation: ExecutionContext

Violation: ExecutionContext created in component
File: apps/web/src/components/user-profile.vue:15

Please fix violation and try again.
Reference: execution-context-skill
```

### GitHub CLI Not Available
```
❌ GitHub CLI not available

Please install GitHub CLI: https://cli.github.com/
```

### Not Authenticated
```
❌ Not authenticated with GitHub

Please run: gh auth login
```

## Integration with Other Commands

**Before PR Creation:**
- `/commit` or `/commit-push` - Commit changes first
- `/test` - Run tests to verify changes

**After PR Creation:**
- `/review-pr` - Review the PR systematically
- `/approve-pr` - Approve the PR (if already reviewed)

## Related

- **`/review-pr`** - Review PRs systematically
- **`/approve-pr`** - Approve PRs quickly
- **`/commit`** - Commit changes
- **`/commit-push`** - Commit and push changes
- **`/test`** - Run tests
- **`pr-review-agent.md`** - Performs PR reviews
- **Architecture skills** - For validation
- **`quality-gates-skill/`** - Quality gate patterns

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'create-pr', 'invoked',
  '{\"base_branch\": \"main\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'create-pr', 'completed', true,
  '{\"outcome\": \"PR created\", \"pr_number\": 123}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'create-pr', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Notes

- Requires GitHub CLI (`gh`) to be installed and authenticated
- Requires appropriate GitHub permissions
- Progressive validation ensures code quality before PR creation
- Auto-generated descriptions include validation results
- Quality gates must pass before PR creation
- Architecture violations block PR creation (critical) or add warnings (minor)

