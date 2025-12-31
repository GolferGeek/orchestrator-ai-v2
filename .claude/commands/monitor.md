---
description: "Run codebase monitoring analysis (incremental or full). Analyzes files hierarchically, evaluates health, identifies issues, generates monitoring artifacts, and optionally scans for quality issues."
argument-hint: "[scope] [--full] [--quality] - Scope: 'apps/web', 'apps/api', 'apps/langgraph', or entire project (default). --full: Full analysis. --quality: Include quality scanning."
category: "quality"
uses-skills: ["codebase-monitoring-skill", "error-registry-skill", "self-reporting-skill"]
uses-agents: ["codebase-monitoring-agent", "error-scanner-agent"]
related-commands: ["harden", "test", "scan-errors", "fix-errors", "quality-status"]
---

# /monitor Command

## Purpose

Run codebase monitoring analysis to analyze files hierarchically, evaluate codebase health, identify issues, and generate monitoring artifacts.

## Usage

```
/monitor [scope] [--full] [--quality]
```

**Arguments:**
- `scope` (optional): Specific directory to analyze
  - `apps/web` - Analyze web app only
  - `apps/api` - Analyze API app only
  - `apps/langgraph` - Analyze LangGraph app only
  - `apps/orch-flow` - Analyze orch-flow app only
  - `apps/open-notebook` - Analyze open-notebook app only
  - `project` - Analyze project-level files only (excludes apps/)
  - (no scope) - Analyze entire project including apps (default)
- `--full` (optional): Full analysis ignoring last monitor date (default is incremental)
- `--quality` (optional): Include quality scanning (build/lint/test) and flow results to code_ops.quality_issues table

## Examples

```
/monitor
# Analyze entire project including apps (incremental - only new/changed files)

/monitor --full
# Analyze entire project including apps (full - all files)

/monitor project
# Analyze project-level files only (excludes apps/)

/monitor project --full
# Analyze project-level files (full analysis, excludes apps/)

/monitor apps/api
# Analyze API app only (incremental)

/monitor apps/web --full
# Analyze web app (full analysis)

/monitor apps/langgraph
# Analyze LangGraph app only (incremental)

/monitor apps/orch-flow
# Analyze orch-flow app only (incremental)

/monitor apps/open-notebook
# Analyze open-notebook app only (incremental)

/monitor apps/api --quality
# Analyze API app with quality scanning (build/lint/test)

/monitor --quality
# Full project monitoring with quality scanning

/monitor apps/web --full --quality
# Full web app analysis with quality scanning
```

## Workflow

1. **Determine Scope**
   - If scope provided: Use specified directory
   - If no scope: Use entire project

2. **Load Existing Artifact** (if exists)
   - Determine artifact path:
     - `.monitor/all.json` - For entire project (including apps)
     - `.monitor/project.json` - For project-level files only (excludes apps/)
     - `.monitor/apps-web.json` - For web app
     - `.monitor/apps-api.json` - For API app
     - `.monitor/apps-langgraph.json` - For LangGraph app
     - `.monitor/apps-orch-flow.json` - For orch-flow app
     - `.monitor/apps-open-notebook.json` - For open-notebook app
   - Load existing artifact
   - Extract `lastMonitorDate` for incremental analysis

3. **Call Monitoring Agent**
   - Call `codebase-monitoring-agent` with:
     - Scope
     - Incremental mode (unless `--full` flag)
     - Existing artifact (if exists)

4. **Agent Analysis**
   - Agent analyzes files hierarchically
   - Evaluates codebase health
   - Identifies issues
   - Generates prioritized issues list
   - Groups related issues into refactorings

5. **Artifact Generation**
   - Agent creates/updates artifact in `.monitor/` directory
   - Includes all file analyses
   - Includes hierarchical breakdown
   - Includes prioritized issues
   - Includes refactorings section
   - Updates `lastMonitorDate`

6. **Quality Scanning (if --quality flag)**
   - Run `npm run build` for specified apps
   - Run `npm run lint` for specified apps
   - Run `npm run test` for specified apps
   - Parse outputs into structured issues
   - UPSERT issues to `code_ops.quality_issues` table
   - Create `scan_runs` record

7. **Display Summary**
   - Show monitoring summary
   - Display prioritized issues
   - Show refactorings
   - If --quality: Show quality issues summary
   - Indicate artifact location

## Artifact Storage

**Location:** `.monitor/` directory (excluded from Git)

**Files:**
- `.monitor/all.json` - Entire project (including apps)
- `.monitor/project.json` - Project-level files only (excludes apps/)
- `.monitor/apps-web.json` - Web app
- `.monitor/apps-api.json` - API app
- `.monitor/apps-langgraph.json` - LangGraph app
- `.monitor/apps-orch-flow.json` - Orch-flow app
- `.monitor/apps-open-notebook.json` - Open-notebook app

## Project-Level Scope

When using `/monitor project`, the following directories/files are analyzed:
- Root config files (`*.json`, `*.js`, `*.ts`, `*.md`, `*.sh`)
- `.claude/` - Claude Code configuration
- `deployment/` - Deployment scripts and configs
- `docs/` - Documentation
- `demo-agents/` - Demo agent definitions
- `supabase/` - Supabase migrations and config
- `storage/` - Storage scripts
- `.github/` - GitHub workflows

**Excluded from project scope:**
- `apps/` - Use specific app scopes instead
- `node_modules/` - Dependencies
- `.git/` - Git internals

## Incremental Monitoring

**Default Behavior:**
- Only analyzes files changed/added since `lastMonitorDate`
- Preserves existing analyses for unchanged files
- Updates `lastMonitorDate` after analysis

**Full Analysis (`--full` flag):**
- Analyzes all files regardless of modification date
- Replaces existing artifact completely
- Useful for first-time monitoring or complete refresh

## Output

**Summary Display:**
- Scope analyzed
- Number of files analyzed
- Number of issues found
- Prioritized issues (top 10)
- Refactorings identified
- Artifact location

**Example:**
```
Monitoring complete!

Scope: apps/api
Files analyzed: 45 (12 new, 33 unchanged)
Issues found: 23
  High urgency: 5
  Medium urgency: 12
  Low urgency: 6

Top Issues:
  #1: Supabase coupling in auth service (high urgency, high severity)
  #2: Missing tests for user service (medium urgency, medium severity)
  ...

Refactorings:
  - supabase-separation (5 issues, high priority)

Artifact saved to: .monitor/apps-api.json
```

## Quality Scanning (--quality flag)

When the `--quality` flag is provided, the monitor command also runs quality scanning:

### What It Does

1. **Runs Quality Commands:**
   - `npm run build` - TypeScript compilation
   - `npm run lint` - ESLint analysis
   - `npm run test` - Jest test execution

2. **Parses Outputs:**
   - Build errors: `filepath(line,col): error TSnnnn: message`
   - Lint errors: `filepath:line:col severity message rule-name`
   - Test failures: `FAIL filepath` with test details

3. **Stores in Database:**
   - Issues stored in `code_ops.quality_issues` table
   - Fingerprint-based deduplication
   - Scan metadata in `code_ops.scan_runs`

4. **Updates Artifact Inventory:**
   - Scans `.claude/` directory
   - Updates `code_ops.artifacts` table
   - Logs `artifact_events`

### Quality Output

When `--quality` is used, output includes:

```
Monitoring complete!

Scope: apps/api
Files analyzed: 45 (12 new, 33 unchanged)
Issues found: 23
  High urgency: 5
  Medium urgency: 12
  Low urgency: 6

Quality Scan Results:
┌─────────────┬───────┬──────┬───────┬───────┐
│ App         │ Build │ Lint │ Tests │ Total │
├─────────────┼───────┼──────┼───────┼───────┤
│ api         │ 0     │ 45   │ 2     │ 47    │
└─────────────┴───────┴──────┴───────┴───────┘

Priority Distribution:
- Critical: 2
- High: 8
- Medium: 35
- Low: 2
- Auto-fixable: 15 (32%)

Top Issues:
  #1: Supabase coupling in auth service (high urgency, high severity)
  #2: Missing tests for user service (medium urgency, medium severity)
  ...

Refactorings:
  - supabase-separation (5 issues, high priority)

Artifact saved to: .monitor/apps-api.json
Quality issues saved to: code_ops.quality_issues
```

### Integration with Quality Commands

Quality scanning is the same as running `/scan-errors` but integrated into the monitoring workflow:

- Use `/monitor --quality` for combined analysis
- Use `/scan-errors` for quality-only scanning
- Use `/quality-status` to view current quality metrics
- Use `/fix-errors` to start parallel fixing

### Database Requirements

Quality scanning requires:
- `code_ops` schema deployed
- `supabase_db_api-dev` container running

## Related

- **`codebase-monitoring-agent.md`** - Performs the analysis
- **`codebase-monitoring-skill/`** - Provides monitoring patterns
- **`error-registry-skill/`** - Database patterns for quality issues
- **`error-scanner-agent.md`** - Quality scanning agent
- **`/harden`** - Uses monitoring artifacts for hardening
- **`/scan-errors`** - Quality-only scanning
- **`/fix-errors`** - Parallel fixing of quality issues
- **`/quality-status`** - View quality metrics

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'monitor', 'invoked',
  '{\"scope\": \"scope\", \"full\": false, \"quality\": false, \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'monitor', 'completed', true,
  '{\"outcome\": \"Monitoring completed\", \"files_analyzed\": N, \"issues_found\": M}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'monitor', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

