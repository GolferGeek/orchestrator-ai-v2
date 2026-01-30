---
description: "Commit changes and push to current branch after quality checks"
category: "development"
uses-skills: ["quality-gates-skill", "self-reporting-skill"]
uses-agents: []
related-commands: ["commit"]
---

# Commit and Push to Current Branch

Commit your changes to the current branch and push to remote after running quality gates (lint, build) and a safety review.

## What This Does

1. **Runs quality gates:**
   - Formats code (`npm run format`)
   - Lints code (`npm run lint` - must pass)
   - Builds code (`npm run build` - must pass)

2. **Performs safety review:**
   - Checks changed files for obvious issues
   - Validates execution context usage (if relevant)
   - Validates transport types (if relevant)
   - Checks architecture patterns

3. **Commits changes:**
   - Stages all changes
   - Generates commit message (or uses provided)
   - Commits to current branch

4. **Pushes to remote:**
   - Fetches remote changes first
   - Merges remote changes if branch has diverged (may prompt for merge approval)
   - Pushes to `origin/current-branch`
   - Handles any push errors

## Usage

```
/commit-push
```

Or with a custom message:

```
/commit-push "feat(api): add new feature"
```

## Quality Gates

All quality gates must pass before committing:

- ✅ **Format**: Code is formatted
- ✅ **Lint**: No lint errors
- ✅ **Build**: Build succeeds
- ✅ **Safety**: No obvious violations found

If any check fails, the commit and push are blocked.

## Safety Review

The safety review checks:

- **Execution Context**: Properly passed and used (if execution context files changed)
- **Transport Types**: A2A compliance maintained (if transport type files changed)
- **Architecture**: Patterns followed (front-end, API, LangGraph)
- **Code Quality**: Error handling, type safety, etc.

## Commit Message

**By default, a commit message is automatically generated** by analyzing your changed files. The message follows conventional commits format:

- `feat(scope): description` - New features
- `fix(scope): description` - Bug fixes
- `refactor(scope): description` - Code restructuring
- etc.

**How it works:**
1. Analyzes git diff to see what changed
2. Reads changed files to understand modifications
3. Determines type (feat, fix, refactor, etc.) from the nature of changes
4. Determines scope (api, web, langgraph, etc.) from file paths
5. Generates a clear, descriptive message

**To use a custom message:**
```
/commit-push "your custom message here"
```

The custom message will be used exactly as provided.

## Push Behavior

After successful commit:
- **Fetches remote changes first** (`git fetch origin`) - **NEVER prompts for approval**
- **If remote has changes:**
  - Pulls and merges remote changes (creates merge commit if needed)
  - Then pushes to `origin/<current-branch>`
- **If no remote changes:**
  - Pushes directly to `origin/<current-branch>`
- **If branch doesn't exist on remote:**
  - Sets upstream and pushes: `git push -u origin <current-branch>`
- **Handles push errors gracefully**

**Note:** The skill has **full permission** to run all git commands (including `git diff` and `git fetch`) without prompting for approval. If you are prompted, this is unexpected - the skill should have automatic permission.

## Examples

### Basic Commit and Push (Auto-Generated Message)
```
/commit-push
```
Runs all checks, analyzes your changes, generates a commit message automatically, commits, then pushes.

**Example:** If you fixed a bug in the web execution context store, it might generate:
```
fix(web): resolve execution context store update issue
```

### Commit and Push with Message
```
/commit-push "feat(langgraph): add execution context integration"
```
Runs checks, uses your message, commits, pushes.

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('command', 'commit-push', 'unknown', 'invoked',
  '{\"branch\": \"current branch\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'commit-push', 'unknown', 'completed', true,
  '{\"outcome\": \"Changes committed and pushed\", \"commit_hash\": \"hash\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'commit-push', 'unknown', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Related

- `/commit` - Commit only (no push)
- `/create-pr` - Create pull request (for PR workflow)

