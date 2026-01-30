---
description: "Commit, push, merge to main, and cleanup branch (code owner workflow)"
category: "development"
uses-skills: ["quality-gates-skill", "self-reporting-skill"]
uses-agents: []
related-commands: ["commit", "commit-push", "create-pr"]
---

# Commit, Merge to Main, and Cleanup

**Code Owner Power Command** - Commit your changes, merge directly to main, and cleanup the feature branch. Bypasses PR workflow for trusted code owners.

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

3. **Commits and pushes to feature branch:**
   - Stages all changes
   - Generates commit message (or uses provided)
   - Commits to current branch
   - Pushes to remote

4. **Merges to main:**
   - Switches to main branch
   - Pulls latest main from remote
   - Merges feature branch into main (with merge commit)
   - Pushes main to remote

5. **Cleans up feature branch:**
   - Deletes feature branch locally
   - Deletes feature branch on remote (origin)

## Usage

```
/commit-merge
```

Or with a custom commit message:

```
/commit-merge "feat(api): add new feature"
```

## Safety Checks

Before proceeding, the command verifies:

- ✅ **Not on main**: Must be on a feature branch (can't merge main into itself)
- ✅ **Quality gates pass**: Format, lint, build all succeed
- ✅ **No uncommitted changes on main**: Main must be clean before merge
- ✅ **Merge succeeds**: No conflicts (aborts if conflicts detected)

## Quality Gates

All quality gates must pass before committing:

- ✅ **Format**: Code is formatted
- ✅ **Lint**: No lint errors
- ✅ **Build**: Build succeeds
- ✅ **Safety**: No obvious violations found

If any check fails, fix the issue before proceeding.

## Fixing Common Lint Errors

### Supabase RPC Type Safety (`@typescript-eslint/no-unsafe-assignment`)

When calling Supabase RPC functions, the return type is `any`. Fix by adding type assertion:

**Before (fails lint):**
```typescript
const { data, error } = await this.getClient()
  .schema(this.schema)
  .rpc('get_sources_due_for_crawl', { p_frequency_minutes: frequency ?? null });
```

**After (passes lint):**
```typescript
const { data, error } = (await this.getClient()
  .schema(this.schema)
  .rpc('get_sources_due_for_crawl', { p_frequency_minutes: frequency ?? null })
) as SupabaseSelectListResponse<SourceDueForCrawl>;
```

Use the appropriate response type:
- `SupabaseSelectResponse<T>` - single record
- `SupabaseSelectListResponse<T>` - array of records

## Merge Strategy

Uses `git merge --no-ff` to create a merge commit that preserves branch history:

```
*   Merge branch 'feature/my-feature' into main
|\
| * feat(api): add new feature
| * fix(api): resolve edge case
|/
*   Previous main commit
```

This makes it easy to see what changes came from which feature branch.

## Conflict Handling

If merge conflicts are detected:

1. **Aborts the merge** (`git merge --abort`)
2. **Switches back to feature branch**
3. **Reports the conflict**
4. **Suggests manual resolution**

You'll need to:
1. Pull latest main into your feature branch
2. Resolve conflicts
3. Run `/commit-merge` again

## Branch Protection

**WARNING:** This command bypasses GitHub PR checks and branch protection rules. Only use if:

- You are a code owner with merge permissions
- You've thoroughly tested your changes
- The changes are low-risk or urgent
- Your repo allows direct pushes to main

If your repo has branch protection enabled, the push to main will fail. Use `/create-pr` instead.

## Examples

### Basic Merge (Auto-Generated Message)
```
/commit-merge
```
Runs all checks, commits with auto-generated message, merges to main, cleans up branch.

### Merge with Custom Message
```
/commit-merge "feat(prediction): add pipeline commands"
```
Uses your commit message, then merges to main and cleans up.

## What Happens Step by Step

```
Feature Branch: feature/my-feature
Main Branch: main

1. [feature/my-feature] Run quality gates (format, lint, build)
2. [feature/my-feature] git add -A
3. [feature/my-feature] git commit -m "your message"
4. [feature/my-feature] git push origin feature/my-feature
5. [main] git checkout main
6. [main] git pull origin main
7. [main] git merge --no-ff feature/my-feature
8. [main] git push origin main
9. [main] git branch -d feature/my-feature
10. [main] git push origin --delete feature/my-feature
11. Done! You're now on main with your changes merged.
```

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('command', 'commit-merge', 'unknown', 'invoked',
  '{\"branch\": \"current branch\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'commit-merge', 'unknown', 'completed', true,
  '{\"outcome\": \"Merged to main and cleaned up\", \"commit_hash\": \"hash\", \"branch_deleted\": \"feature-branch\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('command', 'commit-merge', 'unknown', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Rollback

If something goes wrong after merge:

```bash
# Revert the merge commit on main
git revert -m 1 <merge-commit-hash>
git push origin main
```

Or if you need to restore the feature branch:

```bash
# Find the commit hash from before deletion
git reflog
# Recreate the branch
git checkout -b feature/my-feature <commit-hash>
git push -u origin feature/my-feature
```

## Related

- `/commit` - Commit only (no push, no merge)
- `/commit-push` - Commit and push (no merge)
- `/create-pr` - Create pull request (standard PR workflow)
