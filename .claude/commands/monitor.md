---
description: "Run codebase monitoring analysis (incremental or full). Analyzes files hierarchically, evaluates health, identifies issues, and generates monitoring artifacts."
argument-hint: "[scope] [--full] - Scope: 'apps/web', 'apps/api', 'apps/langgraph', or entire project (default). --full: Full analysis ignoring last monitor date."
---

# /monitor Command

## Purpose

Run codebase monitoring analysis to analyze files hierarchically, evaluate codebase health, identify issues, and generate monitoring artifacts.

## Usage

```
/monitor [scope] [--full]
```

**Arguments:**
- `scope` (optional): Specific directory to analyze
  - `apps/web` - Analyze web app only
  - `apps/api` - Analyze API app only
  - `apps/langgraph` - Analyze LangGraph app only
  - (no scope) - Analyze entire project (default)
- `--full` (optional): Full analysis ignoring last monitor date (default is incremental)

## Examples

```
/monitor
# Analyze entire project (incremental - only new/changed files)

/monitor --full
# Analyze entire project (full - all files)

/monitor apps/api
# Analyze API app only (incremental)

/monitor apps/web --full
# Analyze web app (full analysis)
```

## Workflow

1. **Determine Scope**
   - If scope provided: Use specified directory
   - If no scope: Use entire project

2. **Load Existing Artifact** (if exists)
   - Determine artifact path:
     - `.monitor/project.json` - For entire project
     - `.monitor/apps-web.json` - For web app
     - `.monitor/apps-api.json` - For API app
     - `.monitor/apps-langgraph.json` - For LangGraph app
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

6. **Display Summary**
   - Show monitoring summary
   - Display prioritized issues
   - Show refactorings
   - Indicate artifact location

## Artifact Storage

**Location:** `.monitor/` directory (excluded from Git)

**Files:**
- `.monitor/project.json` - Entire project
- `.monitor/apps-web.json` - Web app
- `.monitor/apps-api.json` - API app
- `.monitor/apps-langgraph.json` - LangGraph app

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

## Related

- **`codebase-monitoring-agent.md`** - Performs the analysis
- **`codebase-monitoring-skill/`** - Provides monitoring patterns
- **`/harden`** - Uses monitoring artifacts for hardening

