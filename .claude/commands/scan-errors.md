---
description: "Scan codebase for build/lint/test errors and store in quality registry. Runs npm run build/lint/test, parses output, and UPSERTs issues to database."
argument-hint: "[app] [--type TYPE] - App: api, web, langgraph, orch-flow, notebook, or all (default). Type: build, lint, test, or all (default)."
category: "quality"
uses-skills: ["error-registry-skill", "self-reporting-skill"]
uses-agents: ["error-scanner-agent"]
related-commands: ["fix-errors", "quality-status", "monitor"]
---

# /scan-errors Command

## Purpose

Scan the codebase for quality issues (build errors, lint errors, test failures) and store them in the centralized error registry (code_ops.quality_issues). This enables parallel fixing and quality tracking.

## Usage

```
/scan-errors [app] [--type TYPE]
```

**Arguments:**
- `app` (optional): Which app to scan
  - `api` - Scan API app only
  - `web` - Scan web app only
  - `langgraph` - Scan LangGraph app only
  - `orch-flow` - Scan orch-flow app only
  - `notebook` - Scan notebook app only
  - `all` - Scan all apps (default)

- `--type TYPE` (optional): Which error types to scan for
  - `build` - Only TypeScript build errors
  - `lint` - Only ESLint lint errors
  - `test` - Only Jest test failures
  - `all` - All error types (default)

## Examples

```
/scan-errors
# Scan all apps for all error types

/scan-errors api
# Scan API app for all error types

/scan-errors web --type lint
# Scan web app for lint errors only

/scan-errors all --type build
# Scan all apps for build errors only

/scan-errors langgraph --type test
# Scan LangGraph app for test failures only
```

## What It Does

1. **Creates Scan Run Record**: Logs scan metadata to `code_ops.scan_runs`
2. **Runs Quality Commands**: Executes `npm run build`, `npm run lint`, `npm run test`
3. **Parses Output**: Extracts structured error data from command output
4. **Computes Fingerprints**: SHA256 hash for deduplication
5. **UPSERTs Issues**: Writes to `code_ops.quality_issues` with deduplication
6. **Populates Artifact Inventory**: Scans .claude/ directory for skills/agents/commands
7. **Displays Dashboard**: Shows summary of issues found

## Workflow

When you invoke `/scan-errors`, the error-scanner-agent will:

```
1. Load error-registry-skill for database patterns
2. Determine scan scope (app filter, type filter)
3. Create scan_runs record
4. For each app in scope:
   a. Run npm run build (if type=all or type=build)
   b. Run npm run lint (if type=all or type=lint)
   c. Run npm run test (if type=all or type=test)
   d. Parse outputs into structured issues
   e. Compute fingerprints
   f. UPSERT issues to quality_issues table
5. Populate artifact inventory
6. Update scan_runs with results
7. Display summary dashboard
```

## Dashboard Output

After scanning, you'll see a dashboard like:

```
Quality Scan Summary
════════════════════════════════════════════════════════════════
Scan ID: abc123-def456
Started: 2025-12-30 10:00:00  Duration: 45s
Branch: main (commit: abc123)
Apps: api, web, langgraph, orch-flow, notebook
Types: build, lint, test

Issues by App
┌─────────────┬───────┬──────┬───────┬───────┐
│ App         │ Build │ Lint │ Tests │ Total │
├─────────────┼───────┼──────┼───────┼───────┤
│ api         │ 0     │ 799  │ 0     │ 799   │
│ web         │ 0     │ 0    │ 0     │ 0     │
│ langgraph   │ 0     │ 59   │ 0     │ 59    │
│ orch-flow   │ 2     │ 15   │ 3     │ 20    │
│ notebook    │ 0     │ 12   │ 0     │ 12    │
├─────────────┼───────┼──────┼───────┼───────┤
│ TOTAL       │ 2     │ 885  │ 3     │ 890   │
└─────────────┴───────┴──────┴───────┴───────┘

Issues by Priority
┌──────────┬───────┬────────────────┐
│ Priority │ Count │ Auto-Fixable   │
├──────────┼───────┼────────────────┤
│ Critical │ 2     │ 0              │
│ High     │ 45    │ 5              │
│ Medium   │ 812   │ 200            │
│ Low      │ 31    │ 31             │
└──────────┴───────┴────────────────┘

New: 15 | Fixed since last: 3 | Reopened: 2
```

## Database Tables Used

- `code_ops.quality_issues` - Stores all issues
- `code_ops.scan_runs` - Stores scan metadata
- `code_ops.artifacts` - Stores artifact inventory
- `code_ops.artifact_events` - Logs scan events

## Error Types

### Build Errors (TypeScript)
- Pattern: `filepath(line,col): error TSnnnn: message`
- Priority: critical
- Auto-fixable: false

### Lint Errors (ESLint)
- Pattern: `filepath:line:col severity message rule-name`
- Priority: medium (warnings), high (errors)
- Auto-fixable: depends on rule (indent, semi, quotes, etc.)

### Test Failures (Jest)
- Pattern: `FAIL filepath` with test details
- Priority: high
- Auto-fixable: false

## Requirements

- Database: code_ops schema must exist (run migration first)
- Container: supabase_db_api-dev must be running
- npm: build/lint/test scripts must be configured

## Next Steps

After scanning, use:
- `/fix-errors` - Start parallel fixing of issues
- `/quality-status` - View current quality metrics
- `/pivot-report` - View learning from fix attempts

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'scan-errors', 'invoked',
  '{\"app\": \"app\", \"type\": \"type\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'scan-errors', 'completed', true,
  '{\"outcome\": \"Scan completed\", \"issues_found\": N}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'scan-errors', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Related

- **error-scanner-agent**: The agent that performs the scan
- **error-registry-skill**: Database patterns used
- **quality-fixer-agent**: Coordinates parallel fixing
- **/fix-errors**: Command to fix scanned issues
- **/quality-status**: Command to view quality metrics
