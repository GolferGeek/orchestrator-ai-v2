---
description: "Start parallel fixing of quality issues using multiple worker agents. Spawns 3-4 file-fixer agents that work simultaneously on different files."
argument-hint: "[app] [--type TYPE] [--priority PRIORITY] [--workers N] - Filters and worker count."
category: "quality"
uses-skills: ["error-registry-skill", "self-reporting-skill"]
uses-agents: ["quality-fixer-agent", "file-fixer-agent"]
related-commands: ["scan-errors", "quality-status"]
---

# /fix-errors Command

## Purpose

Start parallel fixing of quality issues from the error registry. Spawns 3-4 file-fixer worker agents that work simultaneously on different files, coordinated by the quality-fixer-agent.

## Usage

```
/fix-errors [app] [--type TYPE] [--priority PRIORITY] [--workers N]
```

**Arguments:**
- `app` (optional): Which app to fix issues in
  - `api` - Fix API app issues only
  - `web` - Fix web app issues only
  - `langgraph` - Fix LangGraph app issues only
  - `orch-flow` - Fix orch-flow app issues only
  - `notebook` - Fix notebook app issues only
  - `all` - Fix all apps (default)

- `--type TYPE` (optional): Which error types to fix
  - `build` - Only TypeScript build errors
  - `lint` - Only ESLint lint errors
  - `test` - Only Jest test failures
  - `all` - All error types (default)

- `--priority PRIORITY` (optional): Minimum priority to fix
  - `critical` - Only critical priority issues
  - `high` - Critical and high priority
  - `medium` - Critical, high, and medium (default)
  - `low` - All priorities including low

- `--workers N` (optional): Number of parallel workers
  - Default: 3
  - Maximum: 5
  - Fewer workers for targeted fixes, more for bulk fixing

## Examples

```
/fix-errors
# Fix all apps, all types, medium+ priority, 3 workers

/fix-errors api
# Fix API app issues only

/fix-errors web --type lint
# Fix only lint errors in web app

/fix-errors --priority critical
# Fix only critical issues across all apps

/fix-errors api --type lint --workers 4
# Fix lint errors in API with 4 parallel workers

/fix-errors --priority low
# Fix all issues including low priority
```

## What It Does

1. **Queries Error Registry**: Gets open issues from `code_ops.quality_issues`
2. **Groups by File**: Organizes issues by file_path for parallel work
3. **Spawns Workers**: Creates 3-4 file-fixer-agent instances
4. **Assigns Files**: Each worker gets specific files (no overlap)
5. **Fixes in Parallel**: Workers fix their assigned files simultaneously
6. **Tracks Progress**: Live dashboard shows completion status
7. **Verification**: Final scan confirms fixes

## Workflow

When you invoke `/fix-errors`, the quality-fixer-agent coordinator will:

```
1. Load error-registry-skill for database patterns
2. Release any stale claims (>6 hours old)
3. Query open issues grouped by file
4. Sort files by priority (critical/high issues first)
5. Spawn N file-fixer-agent workers
6. Assign files to workers (round-robin)
7. Display progress dashboard
8. When worker completes a file:
   a. Get result summary
   b. Assign next file to that worker
   c. Update dashboard
9. Continue until all files processed
10. Run final verification scan
11. Display summary with metrics
```

Each file-fixer-agent worker will:

```
1. Receive file assignment
2. Claim all issues for that file atomically
3. Sort issues by priority
4. For each issue:
   a. Try auto-fix if applicable (ESLint --fix)
   b. If auto-fix fails or not applicable, do manual fix
   c. Verify the fix
   d. Mark as fixed or record failure
5. Report back to coordinator
```

## Progress Dashboard

During fixing, you'll see a live dashboard:

```
Quality Fix Progress
════════════════════════════════════════════════════════════════
Started: 10:00:00  Elapsed: 2m 15s  Est. Remaining: 8m 30s

Overall: 15/52 files (29%)  |████████░░░░░░░░░░░░░░░░░░░░░░|

Workers:
┌────────┬────────┬──────────────────────────────┬───────────┐
│ Worker │ Status │ Current File                 │ Completed │
├────────┼────────┼──────────────────────────────┼───────────┤
│ #1     │ 🔧     │ apps/api/src/services/auth.ts│ 4 files   │
│ #2     │ 🔧     │ apps/web/src/App.vue         │ 3 files   │
│ #3     │ 🔧     │ apps/api/src/utils/db.ts     │ 5 files   │
│ #4     │ ⏳     │ (waiting for assignment)     │ 3 files   │
└────────┴────────┴──────────────────────────────┴───────────┘

Recent Completions:
- apps/api/src/controllers/user.ts: 5/5 fixed (100%)
- apps/web/src/stores/auth.ts: 3/4 fixed (75%)
- apps/api/src/middleware/error.ts: 2/2 fixed (100%)

Issues: 45/156 fixed (29%)
- Critical: 2/2 (100%)
- High: 15/23 (65%)
- Medium: 28/131 (21%)
```

## Final Summary

After completion:

```
Quality Fix Summary
════════════════════════════════════════════════════════════════
Duration: 12m 45s
Files Processed: 52
Workers Used: 4

Results by App:
┌───────────┬──────────┬───────┬────────┬─────────┐
│ App       │ Attempted│ Fixed │ Failed │ Success │
├───────────┼──────────┼───────┼────────┼─────────┤
│ api       │ 120      │ 105   │ 15     │ 87.5%   │
│ web       │ 25       │ 22    │ 3      │ 88.0%   │
│ langgraph │ 11       │ 10    │ 1      │ 90.9%   │
└───────────┴──────────┴───────┴────────┴─────────┘

Results by Priority:
┌──────────┬──────────┬───────┬────────┬─────────┐
│ Priority │ Attempted│ Fixed │ Failed │ Success │
├──────────┼──────────┼───────┼────────┼─────────┤
│ Critical │ 2        │ 2     │ 0      │ 100%    │
│ High     │ 23       │ 21    │ 2      │ 91.3%   │
│ Medium   │ 131      │ 114   │ 17     │ 87.0%   │
└──────────┴──────────┴───────┴────────┴─────────┘

Failed Issues (require manual review):
1. apps/api/src/complex.ts:45 - TypeScript error requires refactoring
2. apps/web/src/legacy.vue:123 - Deprecated API usage
...

Verification: Re-scan found 0 new issues introduced
```

## How Issues Are Fixed

### Auto-Fixable Lint Errors
```bash
npx eslint --fix <file_path>
```
Works for: indent, semi, quotes, trailing-comma, no-extra-semi, etc.

### Manual Fixes
- **Unused variables**: Remove or use
- **Type errors**: Add/fix type annotations
- **Missing imports**: Add required imports
- **Deprecated APIs**: Update to new patterns

### Complex Issues
- Some issues require significant refactoring
- These are marked as "failed" for manual review
- Fix attempts are recorded for learning

## Requirements

- Database: code_ops schema must exist
- Container: supabase_db_api-dev must be running
- Issues: Run /scan-errors first to populate registry

## Best Practices

1. **Start Small**: Fix one app at a time
2. **Priority First**: Fix critical/high priority first
3. **Verify Often**: Check build/lint/test after fixes
4. **Review Failures**: Some issues need manual attention
5. **Iterate**: Run /fix-errors multiple times if needed

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'fix-errors', 'invoked',
  '{\"app\": \"app\", \"type\": \"type\", \"workers\": N, \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'fix-errors', 'completed', true,
  '{\"outcome\": \"Fixes completed\", \"fixed\": N, \"failed\": M}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'fix-errors', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Related

- **quality-fixer-agent**: Coordinator that orchestrates fixing
- **file-fixer-agent**: Worker that fixes individual files
- **error-registry-skill**: Database patterns used
- **/scan-errors**: Command to populate error registry
- **/quality-status**: Command to view current status
