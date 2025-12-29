---
description: "Run codebase monitoring analysis (incremental or full). Analyzes files hierarchically, evaluates health, identifies issues, and generates monitoring artifacts."
argument-hint: "[scope] [--full] - Scope: 'apps/web', 'apps/api', 'apps/langgraph', or entire project (default). --full: Full analysis ignoring last monitor date."
category: "quality"
uses-skills: ["codebase-monitoring-skill"]
uses-agents: ["codebase-monitoring-agent"]
related-commands: ["harden", "test"]
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
  - `apps/orch-flow` - Analyze orch-flow app only
  - `apps/open-notebook` - Analyze open-notebook app only
  - `project` - Analyze project-level files only (excludes apps/)
  - (no scope) - Analyze entire project including apps (default)
- `--full` (optional): Full analysis ignoring last monitor date (default is incremental)

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

6. **Display Summary**
   - Show monitoring summary
   - Display prioritized issues
   - Show refactorings
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

## Related

- **`codebase-monitoring-agent.md`** - Performs the analysis
- **`codebase-monitoring-skill/`** - Provides monitoring patterns
- **`/harden`** - Uses monitoring artifacts for hardening

