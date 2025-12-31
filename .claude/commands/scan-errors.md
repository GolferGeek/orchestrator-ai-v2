---
description: "Scan codebase for build/lint/test errors and store in quality registry. Runs npm run build/lint/test, parses output, and UPSERTs issues to database."
argument-hint: "[app] [--type TYPE] [--severity SEVERITY] - App: api, web, langgraph, etc. Type: build, lint, test, all. Severity: error (default), warning, all."
category: "quality"
uses-skills: ["error-registry-skill", "self-reporting-skill"]
uses-agents: ["error-scanner-agent"]
related-commands: ["fix-errors", "quality-status", "monitor"]
---

# /scan-errors Command

## CRITICAL: Complete Apps List (DO NOT SKIP ANY)

**When scanning "all" apps, YOU MUST SCAN ALL 7 APPS:**

| # | App Name | Path | Type |
|---|----------|------|------|
| 1 | api | `apps/api` | Node/TypeScript |
| 2 | web | `apps/web` | Node/TypeScript |
| 3 | langgraph | `apps/langgraph` | Node/TypeScript |
| 4 | orch-flow | `apps/orch-flow` | Node/TypeScript |
| 5 | open-notebook | `apps/open-notebook` | Python |
| 6 | observability-client | `apps/observability/client` | Node/TypeScript |
| 7 | observability-server | `apps/observability/server` | Node/TypeScript |

**FAILURE TO SCAN ALL 7 APPS IS A CRITICAL ERROR.**

## Purpose

Scan the codebase for quality issues (build errors, lint errors, test failures) and store them in the centralized error registry (code_ops.quality_issues). This enables parallel fixing and quality tracking.

## Usage

```
/scan-errors [app] [--type TYPE]
```

**Arguments:**
- `app` (optional): Which app to scan
  - `api` - Scan API app only (Node/TypeScript)
  - `web` - Scan web app only (Node/TypeScript)
  - `langgraph` - Scan LangGraph app only (Node/TypeScript)
  - `orch-flow` - Scan orch-flow app only (Node/TypeScript)
  - `notebook` - Scan open-notebook app only (Python - uses mypy/ruff/pytest)
  - `observability-client` - Scan observability client app only (Node/TypeScript)
  - `observability-server` - Scan observability server app only (Node/TypeScript)
  - `all` - Scan all apps (default)

- `--type TYPE` (optional): Which error types to scan for
  - `build` - Only TypeScript build errors
  - `lint` - Only ESLint lint errors
  - `test` - Only Jest test failures
  - `all` - All error types (default)

- `--severity SEVERITY` (optional): Which severity levels to include
  - `error` - Only errors (default)
  - `warning` - Only warnings
  - `all` - Both errors and warnings

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

/scan-errors api --type lint --severity warning
# Scan API for lint warnings only (e.g., unused eslint-disable directives)

/scan-errors api --type lint --severity all
# Scan API for both lint errors and warnings

/scan-errors notebook
# Scan notebook (Python) for mypy, ruff, and pytest issues

/scan-errors observability-client --type build
# Scan observability client for build errors only
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
4. For each Node/TypeScript app in scope (api, web, langgraph, orch-flow, observability-*):
   a. Run npm run build (if type=all or type=build)
   b. Run npm run lint (if type=all or type=lint)
   c. Run npm run test (if type=all or type=test)
   d. Parse outputs into structured issues
   e. Compute fingerprints
   f. UPSERT issues to quality_issues table
5. For Python apps (notebook):
   a. Run make lint (mypy) and make ruff (if type=all or type=lint)
   b. Run uv run pytest (if type=all or type=test)
   c. Parse Python-specific error formats
   d. Compute fingerprints
   e. UPSERT issues to quality_issues table
6. Populate artifact inventory
7. Update scan_runs with results
8. Display summary dashboard
```

## Dashboard Output

After scanning, you'll see a dashboard like:

```
Quality Scan Summary
════════════════════════════════════════════════════════════════
Scan ID: abc123-def456
Started: 2025-12-30 10:00:00  Duration: 45s
Branch: main (commit: abc123)
Apps: api, web, langgraph, orch-flow, notebook, observability-client, observability-server
Types: build, lint, test

Issues by App
┌───────────────────────┬───────┬──────┬───────┬───────┐
│ App                   │ Build │ Lint │ Tests │ Total │
├───────────────────────┼───────┼──────┼───────┼───────┤
│ api                   │ 0     │ 799  │ 0     │ 799   │
│ web                   │ 0     │ 0    │ 0     │ 0     │
│ langgraph             │ 0     │ 59   │ 0     │ 59    │
│ orch-flow             │ 2     │ 15   │ 3     │ 20    │
│ notebook (Python)     │ 0     │ 12   │ 0     │ 12    │
│ observability-client  │ 0     │ 5    │ 0     │ 5     │
│ observability-server  │ 0     │ 3    │ 0     │ 3     │
├───────────────────────┼───────┼──────┼───────┼───────┤
│ TOTAL                 │ 2     │ 893  │ 3     │ 898   │
└───────────────────────┴───────┴──────┴───────┴───────┘

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

### Node/TypeScript Apps

#### Build Errors (TypeScript)
- Pattern: `filepath(line,col): error TSnnnn: message`
- Priority: critical
- Auto-fixable: false

#### Lint Errors (ESLint)
- Pattern: `filepath:line:col error message rule-name`
- Priority: high (errors)
- Auto-fixable: depends on rule (indent, semi, quotes, etc.)

#### Lint Warnings (ESLint)
- Pattern: `filepath:line:col warning message rule-name`
- Priority: low (warnings)
- Auto-fixable: true for unused eslint-disable directives (remove the comment)
- Common warnings:
  - `Unused eslint-disable directive` - eslint-disable comment no longer needed
  - `Definition for rule X was not found` - unknown rule referenced

#### Test Failures (Jest)
- Pattern: `FAIL filepath` with test details
- Priority: high
- Auto-fixable: false

### Python Apps (notebook)

#### Type Errors (mypy)
- Pattern: `filepath:line: error: message [error-code]`
- Priority: high (type errors), medium (missing annotations)
- Auto-fixable: false

#### Lint Errors (ruff)
- Pattern: `filepath:line:col: CODE message`
- Priority: low (formatting), medium (code quality)
- Auto-fixable: true for E1xx, E2xx, W, I codes (formatting/imports)

#### Test Failures (pytest)
- Pattern: `FAILED filepath::test_name - message`
- Priority: high
- Auto-fixable: false

## Requirements

- Database: code_ops schema must exist (run migration first)
- Container: supabase_db_api-dev must be running
- Node/TypeScript apps: npm build/lint/test scripts must be configured
- Python apps: make lint, make ruff, uv run pytest must be available

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
