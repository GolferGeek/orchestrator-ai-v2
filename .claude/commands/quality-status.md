---
description: "Display current error registry status with counts by app, type, priority, and recent activity. Quick view of codebase quality health."
argument-hint: "[app] [--detailed] - Filter by app, show detailed breakdown."
category: "quality"
uses-skills: ["error-registry-skill", "self-reporting-skill"]
related-commands: ["scan-errors", "fix-errors"]
---

# /quality-status Command

## Purpose

Display the current state of the error registry, showing quality metrics across the codebase. Provides a quick dashboard view of build errors, lint issues, test failures, and fix progress.

## Usage

```
/quality-status [app] [--detailed]
```

**Arguments:**
- `app` (optional): Filter to specific app
  - `api` - Show API app status only
  - `web` - Show web app status only
  - `langgraph` - Show LangGraph app status only
  - `orch-flow` - Show orch-flow app status only
  - `notebook` - Show notebook app status only
  - (no filter) - Show all apps (default)

- `--detailed` (optional): Show detailed breakdown including:
  - Top files with most issues (hotspots)
  - Recent fix activity
  - Claimed issues by agent
  - Stale claims

## Examples

```
/quality-status
# Show overall quality status for all apps

/quality-status api
# Show API app quality status only

/quality-status --detailed
# Show detailed breakdown with hotspots

/quality-status web --detailed
# Show detailed web app status with hotspots
```

## Dashboard Output

### Basic View

```
Quality Status
════════════════════════════════════════════════════════════════
Last Scan: 2025-12-30 10:00:00 (2 hours ago)
Database: code_ops @ supabase_db_api-dev

Issues by App:
┌─────────────┬───────┬──────┬───────┬───────┬─────────┐
│ App         │ Build │ Lint │ Tests │ Total │ Status  │
├─────────────┼───────┼──────┼───────┼───────┼─────────┤
│ api         │ 0     │ 799  │ 0     │ 799   │ ⚠️ High  │
│ web         │ 0     │ 15   │ 0     │ 15    │ ✓ Good  │
│ langgraph   │ 0     │ 59   │ 0     │ 59    │ ⚠️ Med   │
│ orch-flow   │ 2     │ 15   │ 3     │ 20    │ ❌ Build │
│ notebook    │ 0     │ 12   │ 0     │ 12    │ ✓ Good  │
├─────────────┼───────┼──────┼───────┼───────┼─────────┤
│ TOTAL       │ 2     │ 900  │ 3     │ 905   │         │
└─────────────┴───────┴──────┴───────┴───────┴─────────┘

Issues by Priority:
┌──────────┬───────┬────────┬─────────┬────────────────┐
│ Priority │ Open  │ Claimed│ Fixed   │ Auto-Fixable   │
├──────────┼───────┼────────┼─────────┼────────────────┤
│ Critical │ 2     │ 0      │ 0       │ 0              │
│ High     │ 45    │ 5      │ 10      │ 5              │
│ Medium   │ 812   │ 20     │ 150     │ 200            │
│ Low      │ 46    │ 0      │ 25      │ 31             │
└──────────┴───────┴────────┴─────────┴────────────────┘

Summary:
- Open: 905 issues
- In Progress: 25 issues (3 agents working)
- Fixed Today: 185 issues
- Auto-Fixable: 236 issues (26%)
```

### Detailed View (--detailed)

```
Quality Status (Detailed)
════════════════════════════════════════════════════════════════

[Basic dashboard as above...]

Top Issue Hotspots:
┌────┬────────────────────────────────────────┬───────┬──────────┐
│ #  │ File                                   │ Issues│ Priority │
├────┼────────────────────────────────────────┼───────┼──────────┤
│ 1  │ apps/api/src/services/agent.service.ts│ 45    │ 2 crit   │
│ 2  │ apps/api/src/runners/base.runner.ts   │ 32    │ 1 high   │
│ 3  │ apps/web/src/components/Chat.vue      │ 28    │ 3 high   │
│ 4  │ apps/api/src/utils/helpers.ts         │ 24    │ all med  │
│ 5  │ apps/langgraph/src/tools/search.ts    │ 21    │ 1 high   │
└────┴────────────────────────────────────────┴───────┴──────────┘

Active Fix Sessions:
┌─────────────────────────┬────────────────┬───────┬──────────┐
│ Agent                   │ Started        │ Files │ Fixed    │
├─────────────────────────┼────────────────┼───────┼──────────┤
│ file-fixer-agent-abc123 │ 10 min ago     │ 5     │ 12       │
│ file-fixer-agent-def456 │ 10 min ago     │ 4     │ 8        │
│ file-fixer-agent-ghi789 │ 10 min ago     │ 3     │ 5        │
└─────────────────────────┴────────────────┴───────┴──────────┘

Recent Activity:
┌──────────────┬──────────────────────────────────────┬────────┐
│ Time         │ Event                                │ Count  │
├──────────────┼──────────────────────────────────────┼────────┤
│ 5 min ago    │ Issues fixed                         │ 15     │
│ 10 min ago   │ Scan completed                       │ +0/-5  │
│ 15 min ago   │ Issues fixed                         │ 23     │
│ 1 hour ago   │ Scan completed                       │ +12/-0 │
└──────────────┴──────────────────────────────────────┴────────┘

Stale Claims (>6 hours):
- None (claims auto-release after 6 hours)

Daily Trend:
┌────────────┬───────┬───────┬─────────┐
│ Date       │ New   │ Fixed │ Net     │
├────────────┼───────┼───────┼─────────┤
│ 2025-12-30 │ 12    │ 185   │ -173 ✓  │
│ 2025-12-29 │ 45    │ 120   │ -75 ✓   │
│ 2025-12-28 │ 234   │ 50    │ +184 ⚠️  │
└────────────┴───────┴───────┴─────────┘
```

## Database Queries Used

The command queries the following from code_ops schema:

- `quality_issues` - Issue counts by app, type, priority, status
- `scan_runs` - Last scan information
- `codebase_health_daily` - Daily health metrics (view)
- `fix_attempts` - Recent fix activity

## Status Indicators

- ✓ **Good**: < 20 issues, no critical/high
- ⚠️ **Medium**: 20-100 issues or has high priority
- ⚠️ **High**: > 100 issues
- ❌ **Build**: Has build errors (critical)
- ❌ **Tests**: Has test failures (critical)

## Requirements

- Database: code_ops schema must exist
- Container: supabase_db_api-dev must be running
- Data: Run /scan-errors first to populate registry

## Workflow

```
1. Query overall issue counts from quality_issues
2. Group by app, error_type, priority, status
3. Calculate auto-fixable counts
4. Get last scan info from scan_runs
5. If --detailed:
   a. Query top hotspot files
   b. Get active fix sessions (claimed issues)
   c. Get recent activity from fix_attempts
   d. Calculate daily trends
6. Format and display dashboard
```

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'quality-status', 'invoked',
  '{\"app\": \"app\", \"detailed\": false, \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'quality-status', 'completed', true,
  '{\"outcome\": \"Status displayed\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'quality-status', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Related

- **error-registry-skill**: Database query patterns
- **/scan-errors**: Populate the error registry
- **/fix-errors**: Start parallel fixing
- **/pivot-report**: View learning from fixes
