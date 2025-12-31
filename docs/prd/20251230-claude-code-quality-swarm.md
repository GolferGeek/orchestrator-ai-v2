# PRD: Claude Code Quality Swarm & Self-Evaluation System

**Date:** 2025-12-30
**Author:** GolferGeek + Claude
**Status:** Draft
**Priority:** High

---

## Executive Summary

Build a comprehensive quality monitoring and self-improvement system for the Claude Code ecosystem. This system will:

1. **Track all code quality issues** (build errors, lint errors, test failures) in a central database
2. **Enable parallel fixing** by multiple Claude Code sub-agents pulling from a shared queue
3. **Record learning moments** - when agents try something that doesn't work and pivot
4. **Enable continuous improvement** of the Claude Code ecosystem based on evaluation data

This is **not** about Orchestrator AI agents (the product) - this is about improving the Claude Code development tooling we use to build Orchestrator AI.

---

## Glossary

| Term | Definition |
|------|------------|
| **Skill** | A markdown file that provides domain knowledge, patterns, and guidelines for Claude Code. Skills are loaded when relevant to help agents follow best practices. |
| **Agent** | A specialized Claude Code sub-process that handles complex, multi-step tasks autonomously. Agents have specific capabilities and tools. |
| **Command** | A user-invocable shortcut (e.g., `/commit`, `/test`) that triggers a skill or agent. |
| **Main Agent** | The primary Claude Code instance coordinating work and spawning sub-agents. |
| **Fixer Agent** | A sub-agent dedicated to fixing a specific type of error (build, lint, test). |

---

## Monorepo Apps

The following apps exist in the monorepo. All scanning, fixing, and monitoring operates on these apps:

| App | Description | Path |
|-----|-------------|------|
| `api` | NestJS backend API | `apps/api` |
| `web` | Vue.js frontend | `apps/web` |
| `langgraph` | LangGraph workflows | `apps/langgraph` |
| `orch-flow` | Orch-flow application | `apps/orch-flow` |
| `notebook` | Notebook application | `apps/notebook` |

---

## Problem Statement

### Current Pain Points

1. **No visibility into code quality across monorepo**
   - Must manually run lint/build/test on each app
   - No historical tracking of issues
   - No way to measure improvement over time

2. **Serial fixing is slow**
   - One agent fixes one file at a time
   - No coordination between parallel agents
   - Duplicate work possible

3. **No learning from failures**
   - When an agent tries something that doesn't work, that knowledge is lost
   - Same mistakes get repeated
   - No feedback loop for improvement

4. **Skills/agents degrade over time**
   - Patterns become outdated
   - Keywords stop matching
   - No feedback loop for improvement

---

## Goals

### Primary Goals

1. **Centralized Error Registry**: Single source of truth for all code quality issues
2. **Parallel Auto-Fixing**: Multiple agents fix different files simultaneously (by file assignment)
3. **Learning from Pivots**: Record when agents try something and need to change approach
4. **Continuous Improvement**: Use data to improve skills, agents, and commands

### Success Metrics

| Metric | Target |
|--------|--------|
| Time to fix all lint errors | Reduce by 50% |
| Pivot learning capture rate | >80% |
| Agent task success rate | >90% |
| Mean time to identify failing skill | <1 day |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GG-Mac Studio                               │
│                    (Code Operations Database)                       │
│                       gg-macstudio:6010                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     code_ops schema                          │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │quality_issues│  │pivot_learnings│ │artifact_events│       │   │
│  │  │              │  │              │  │              │       │   │
│  │  │ Build errors │  │ What tried   │  │ Calls +       │       │   │
│  │  │ Lint errors  │  │ Why failed   │  │ Failures      │       │   │
│  │  │ Test failures│  │ New approach │  │ (stream)      │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │ fix_attempts │  │codebase_health│  │ artifacts     │       │   │
│  │  │              │  │              │  │ (inventory)   │       │   │
│  │  │ What was tried│ │ Daily rollup │  │               │       │   │
│  │  │ Diffs/changes│  │ Trends       │  │               │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │   Scanner   │   │   Fixers    │   │  Improver   │
    │   Agent     │   │   Agents    │   │   Agent     │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### Database Connection

| Property | Value |
|----------|-------|
| **Host** | `gg-macstudio` |
| **Port** | `6010` |
| **Schema** | `code_ops` |
| **Auth** | Standard Supabase credentials |

**Credentials (recommended):**
- Store connection info as environment variables (not committed), e.g.:
  - `CODE_OPS_DATABASE_URL=postgresql://<user>:<password>@gg-macstudio:6010/postgres`

**Rationale:**
- Separate from production data
- Always available during development
- Can be reset without affecting users
- Local = fast queries

---

## Database Schema

### Table: `quality_issues`

Tracks every build/lint/test error across the monorepo.

```sql
CREATE TABLE code_ops.quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Location
  app TEXT NOT NULL,              -- 'api', 'web', 'langgraph', 'orch-flow', 'notebook'
  file_path TEXT NOT NULL,
  line_number INT,
  column_number INT,

  -- Identity / de-dupe
  -- Stable identifier for "the same issue" across repeated scans.
  -- This prevents repeated scans from creating duplicates while still letting us track last_seen_at.
  -- Recommended: hash of normalized (app, file_path, error_type, error_code/rule_name, message, line_number, column_number).
  issue_fingerprint TEXT NOT NULL,

  -- Issue details
  error_type TEXT NOT NULL,       -- 'build', 'lint', 'test'
  error_code TEXT,                -- 'TS2352', '@typescript-eslint/no-explicit-any'
  rule_name TEXT,                 -- For lint errors
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'error',  -- 'error', 'warning'

  -- Priority & Category
  priority TEXT DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  is_auto_fixable BOOLEAN DEFAULT FALSE, -- Can ESLint --fix handle this?
  error_category TEXT,            -- 'type-error', 'unused-var', 'formatting', etc.

  -- Status tracking
  status TEXT DEFAULT 'open',     -- 'open', 'claimed', 'fixing', 'fixed', 'wont_fix'
  claimed_by TEXT,                -- Agent ID that claimed it
  claimed_at TIMESTAMPTZ,

  -- Resolution
  fixed_at TIMESTAMPTZ,
  fix_commit TEXT,
  fix_approach TEXT,              -- How it was fixed

  -- Scan tracking
  scan_id UUID,                   -- Which scan found this
  last_seen_at TIMESTAMPTZ,       -- Last scan that saw this issue

  CONSTRAINT valid_status CHECK (status IN ('open', 'claimed', 'fixing', 'fixed', 'wont_fix')),
  CONSTRAINT valid_error_type CHECK (error_type IN ('build', 'lint', 'test')),
  CONSTRAINT valid_priority CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT valid_app CHECK (app IN ('api', 'web', 'langgraph', 'orch-flow', 'notebook'))
);

CREATE INDEX idx_quality_issues_status ON code_ops.quality_issues(status);
CREATE INDEX idx_quality_issues_app ON code_ops.quality_issues(app);
CREATE INDEX idx_quality_issues_file ON code_ops.quality_issues(file_path);
CREATE INDEX idx_quality_issues_type ON code_ops.quality_issues(error_type);
CREATE INDEX idx_quality_issues_priority ON code_ops.quality_issues(priority);
CREATE INDEX idx_quality_issues_claimed ON code_ops.quality_issues(claimed_at) WHERE status = 'claimed';
CREATE UNIQUE INDEX uq_quality_issues_fingerprint ON code_ops.quality_issues(issue_fingerprint);
```

**Scan behavior (MVP):**
- Scanner computes `issue_fingerprint` and **UPSERTs** into `quality_issues`.
- On every scan: set `scan_id = <scan_runs.id>`, set `last_seen_at = NOW()`.
- If an issue previously marked `fixed` reappears, set `status = 'open'` again (reopen).

**Fingerprint computation spec (MVP):**
- **Hash algorithm**: SHA256 (hex string)
- **Field order**: `app|file_path|error_type|error_code_or_rule|message|line|col`
  - `error_code_or_rule`: `COALESCE(error_code, rule_name, '')`
  - `line`: `COALESCE(line_number::text, '')`
  - `col`: `COALESCE(column_number::text, '')`
- **Normalization**:
  - Trim whitespace on each field
  - Collapse internal whitespace in `message` to single spaces
  - Do not lowercase file paths (preserve case)

### Claim Expiry Logic

Claims automatically expire after 6 hours to prevent stale locks:

```sql
-- Function to release stale claims (run periodically or before claiming)
CREATE OR REPLACE FUNCTION code_ops.release_stale_claims()
RETURNS INT AS $$
DECLARE
  released_count INT;
BEGIN
  UPDATE code_ops.quality_issues
  SET status = 'open', claimed_by = NULL, claimed_at = NULL
  WHERE status = 'claimed'
    AND claimed_at < NOW() - INTERVAL '6 hours';

  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Call before claiming to clean up stale claims
-- SELECT code_ops.release_stale_claims();
```

### Atomic Claiming (Recommended)

To avoid two fixers claiming the same file/issues at the same time, claims should be done with a single, atomic DB operation (so the coordinator can safely run fixers in parallel).

```sql
-- Claim all open issues for a given file in one atomic operation.
-- Uses SKIP LOCKED so concurrent claimers don't collide.
CREATE OR REPLACE FUNCTION code_ops.claim_issues_for_file(
  p_file_path TEXT,
  p_claimed_by TEXT,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INT AS $$
DECLARE
  claimed_count INT;
BEGIN
  -- Release stale claims first (keeps locking semantics simple)
  PERFORM code_ops.release_stale_claims();

  WITH to_claim AS (
    SELECT id
    FROM code_ops.quality_issues
    WHERE status = 'open'
      AND file_path = p_file_path
    FOR UPDATE SKIP LOCKED
  )
  UPDATE code_ops.quality_issues qi
  SET status = 'claimed',
      claimed_by = p_claimed_by,
      claimed_at = p_now
  FROM to_claim
  WHERE qi.id = to_claim.id;

  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  RETURN claimed_count;
END;
$$ LANGUAGE plpgsql;
```

**Status transitions (MVP):**
- `open` → `claimed`: atomic claim (above)
- `claimed` → `fixing`: fixer starts work (optional but useful)
- `fixing` → `fixed`: after verification scan passes for that issue/file

### Table: `scan_runs`

Tracks each time we scan for errors.

```sql
CREATE TABLE code_ops.scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- What was scanned
  scan_type TEXT NOT NULL,        -- 'full', 'incremental', 'app-specific'
  apps_scanned TEXT[],            -- ['api', 'web', 'langgraph', 'orch-flow', 'notebook']

  -- Source context (needed for confidence + comparisons)
  repo TEXT,
  branch TEXT,
  commit_sha TEXT,
  is_dirty BOOLEAN DEFAULT FALSE,

  -- Environment context (helps debug "works on my machine")
  runner_id TEXT,                 -- 'gg-macstudio', 'laptop', etc.
  os TEXT,
  node_version TEXT,
  package_manager TEXT,           -- 'pnpm', 'npm'
  package_manager_version TEXT,

  -- Tooling versioning (ties results back to the code that performed the scan)
  scanner_version TEXT,           -- e.g., git sha or file hash of scanner agent/command

  -- Results
  build_errors_found INT DEFAULT 0,
  lint_errors_found INT DEFAULT 0,
  test_failures_found INT DEFAULT 0,
  total_issues INT DEFAULT 0,

  -- Comparison to previous
  new_issues INT DEFAULT 0,
  fixed_since_last INT DEFAULT 0,

  -- Meta
  duration_ms INT,
  triggered_by TEXT               -- 'manual', 'scheduled', 'monitor'
);
```

### Table: `pivot_learnings`

Records when agents try something that doesn't work and need to change approach. This is the core of our learning system.

```sql
CREATE TABLE code_ops.pivot_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  agent_type TEXT NOT NULL,       -- Which agent was working
  task_description TEXT,          -- What was being attempted
  file_path TEXT,                 -- Which file was being worked on
  issue_id UUID REFERENCES code_ops.quality_issues(id),

  -- What was tried
  approach_tried TEXT NOT NULL,   -- What the agent tried
  tool_used TEXT,                 -- Which tool was used (Edit, Bash, etc.)

  -- Why it failed
  failure_type TEXT,              -- 'build-error', 'lint-error', 'test-failure', 'runtime-error', 'logic-error'
  failure_message TEXT,           -- The actual error message

  -- The pivot
  new_approach TEXT NOT NULL,     -- What the agent decided to try instead
  why_pivot TEXT,                 -- Reasoning for the change

  -- Outcome
  new_approach_worked BOOLEAN,    -- Did the new approach succeed?

  -- Learning
  lesson_learned TEXT,            -- Key takeaway for future
  applies_to TEXT[]               -- Tags: ['typescript', 'eslint', 'testing', etc.]
);

CREATE INDEX idx_pivot_learnings_agent ON code_ops.pivot_learnings(agent_type);
CREATE INDEX idx_pivot_learnings_failure ON code_ops.pivot_learnings(failure_type);
CREATE INDEX idx_pivot_learnings_applies ON code_ops.pivot_learnings USING GIN(applies_to);
```

### Table: `skill_events`

Tracks skill discovery and usage.

**Note on overlap with `artifact_events`:**
- `artifact_events` is the **unified, lightweight call/event stream** for *everything* (skills, agents, commands) and is the primary source for “never called” + summary views.
- `skill_events` is **skill-specific analytics** (patterns_available/used/ignored, was_followed, etc.) and can be implemented incrementally after the event stream is in place.

```sql
CREATE TABLE code_ops.skill_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  agent_type TEXT,                -- Which agent was running

  -- Run context / outcome linkage
  scan_id UUID REFERENCES code_ops.scan_runs(id),
  issue_id UUID REFERENCES code_ops.quality_issues(id),
  fix_attempt_id UUID,             -- references code_ops.fix_attempts(id); add FK after table creation if desired

  -- Skill info
  skill_name TEXT NOT NULL,       -- 'api-architecture-skill'
  skill_category TEXT,            -- 'architecture', 'testing', 'quality'
  skill_version TEXT,             -- e.g., hash of skill file contents

  -- Discovery phase
  was_searched_for BOOLEAN,       -- Did agent look for this skill?
  was_found BOOLEAN,              -- Was it found when searched?
  discovery_method TEXT,          -- 'keyword', 'mandatory', 'explicit', 'related'
  search_query TEXT,              -- What query was used to find it
  search_attempts INT DEFAULT 1,  -- How many searches before found

  -- Usage phase
  was_loaded BOOLEAN DEFAULT FALSE,
  was_followed BOOLEAN,           -- Did agent follow the patterns?

  -- Command info (for command-level trust)
  command_name TEXT,              -- '/scan-errors', '/fix-errors', '/monitor', etc.
  command_version TEXT,           -- e.g., hash of command definition

  -- Pattern tracking
  patterns_available JSONB,       -- Patterns defined in skill
  patterns_used JSONB,            -- Which patterns were actually used
  patterns_ignored JSONB,         -- Which patterns were skipped

  -- Effectiveness
  helped_task BOOLEAN,            -- Did loading this skill help?
  rating INT,                     -- 1-5 how useful was it
  notes TEXT,

  CONSTRAINT valid_skill_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX idx_skill_events_name ON code_ops.skill_events(skill_name);
CREATE INDEX idx_skill_events_found ON code_ops.skill_events(was_found);
```

### Table: `fix_attempts`

Links issues to fix attempts.

```sql
CREATE TABLE code_ops.fix_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Links
  issue_id UUID REFERENCES code_ops.quality_issues(id),
  scan_id UUID REFERENCES code_ops.scan_runs(id),

  -- What was tried
  approach TEXT NOT NULL,         -- Description of fix approach
  diff TEXT,                      -- The actual changes made

  -- Result
  succeeded BOOLEAN,
  verified BOOLEAN,               -- Did re-running check confirm fix?
  verification_output TEXT,

  -- If failed
  failure_reason TEXT,
  will_retry BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_fix_attempts_issue ON code_ops.fix_attempts(issue_id);
```

### Skill/Command Trust Signals (MVP)

To make skills and commands “trustable” over time, we tie telemetry to outcomes and versions:
- **Versioned evidence**: `skill_version`, `command_version`, `scanner_version` allow comparisons pre/post change
- **Outcome linkage**: `skill_events.scan_id`, `skill_events.fix_attempt_id`, `skill_events.issue_id`

**Minimum metrics we can compute early:**
- **Success rate**: % of fix attempts that succeed + verify (`fix_attempts.succeeded` + `verified`)
- **Time-to-fix**: from first `last_seen_at` (or `created_at`) to `fixed_at`
- **Reopen rate**: % of fingerprints that return after being marked fixed
- **Skill effectiveness over time**: compare success/reopen/time-to-fix by `skill_version` / `command_version`

### Unified Call/Event Stream + Human-Friendly Views (Recommended)

We want the system to reliably answer questions like:
- “Which skills/agents/commands are **never called**?”
- “What is being used most?”
- “When something fails, what failed, how often, and what are the top recurring issues?”

The simplest and most reliable pattern is:
1. **Inventory table**: baseline list of everything that exists (so “0 calls” is representable)
2. **Single event stream**: append-only log of every call + any errors/pivots as additional events
3. **Views (or materialized views)**: the “human interface” so you can inspect health without writing SQL against raw events

#### Table: `artifacts` (Inventory / Baseline)

Tracks all Claude Code artifacts that exist in the repo:
- Skills: `.claude/skills/**/SKILL.md`
- Agents: `.claude/agents/*.md`
- Commands: `.claude/commands/*.md`

```sql
CREATE TABLE code_ops.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_type TEXT NOT NULL,     -- 'skill', 'agent', 'command'
  name TEXT NOT NULL,              -- canonical name, e.g. 'pivot-learning-skill' or '/scan-errors'
  file_path TEXT NOT NULL,
  version_hash TEXT NOT NULL,      -- hash of file contents
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT valid_artifact_type CHECK (artifact_type IN ('skill', 'agent', 'command'))
);

CREATE UNIQUE INDEX uq_artifacts_type_name_version
  ON code_ops.artifacts(artifact_type, name, version_hash);
```

**How `artifacts` is populated (MVP):**
- At the start of each relevant run (e.g., `/scan-errors`, `/monitor`, evaluation runs), scan:
  - `.claude/skills/**/SKILL.md`
  - `.claude/agents/*.md`
  - `.claude/commands/*.md`
- Upsert each artifact into `code_ops.artifacts`
- **`version_hash`**: SHA256 (hex) of the file contents

#### Table: `artifact_events` (Single Event Stream)

All calls to everything go here (agent/skill/command). If there’s an issue, we log an additional event linked by `run_id` / `correlation_id`.

```sql
CREATE TABLE code_ops.artifact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Correlation / run context
  run_id UUID,                     -- groups events from one command/agent run (optional but recommended)
  scan_id UUID REFERENCES code_ops.scan_runs(id),

  -- What happened
  artifact_type TEXT NOT NULL,     -- 'skill', 'agent', 'command'
  artifact_name TEXT NOT NULL,     -- name at time of event
  artifact_version TEXT NOT NULL,  -- version hash at time of event
  event_type TEXT NOT NULL,        -- 'invoked', 'loaded', 'started', 'completed', 'error', 'pivot'

  -- Outcome
  success BOOLEAN,
  rating INT,                      -- optional 1-5 (e.g., "did this help?")
  issue_count INT DEFAULT 0,        -- quick count of issues in this event (optional)

  -- Details (keep small; raw data lives here; summaries live in views)
  details JSONB,

  CONSTRAINT valid_artifact_type CHECK (artifact_type IN ('skill', 'agent', 'command'))
);

CREATE INDEX idx_artifact_events_ts ON code_ops.artifact_events(timestamp);
CREATE INDEX idx_artifact_events_artifact ON code_ops.artifact_events(artifact_type, artifact_name);
CREATE INDEX idx_artifact_events_event_type ON code_ops.artifact_events(event_type);
```

**Logging rules (MVP):**
- Every time a command/agent/skill is called/started/loaded: write one event (small payload).
- If something fails: write an `event_type='error'` event (and optionally a `pivot` event) with short `details`.

#### Views (Human Interface)

These are the primary “look here first” interfaces for the human-in-the-loop.

**View: `v_artifact_daily_summary`**
- One row per day per artifact (including zeros)
- Includes an `issues_rollup` JSONB so you can scan without raw-event queries

```sql
CREATE VIEW code_ops.v_artifact_daily_summary AS
WITH days AS (
  SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
),
artifact_days AS (
  SELECT d.day, a.artifact_type, a.name, a.file_path, a.version_hash
  FROM days d
  CROSS JOIN code_ops.artifacts a
  WHERE a.is_active = TRUE
)
SELECT
  ad.day,
  ad.artifact_type,
  ad.name,
  ad.file_path,
  ad.version_hash,

  -- Simple columns
  COUNT(e.id) FILTER (WHERE e.event_type IN ('invoked','loaded','started')) AS call_count,
  COUNT(e.id) FILTER (WHERE e.event_type = 'error') AS error_count,
  COUNT(e.id) FILTER (WHERE e.event_type = 'pivot') AS pivot_count,
  MAX(e.timestamp) AS last_event_at,
  ROUND(AVG(e.rating) FILTER (WHERE e.rating IS NOT NULL), 2) AS avg_rating,

  -- JSON rollup (keep it compact; use event IDs to drill down)
  jsonb_build_object(
    'by_event_type', jsonb_build_object(
      'invoked', COUNT(e.id) FILTER (WHERE e.event_type = 'invoked'),
      'loaded', COUNT(e.id) FILTER (WHERE e.event_type = 'loaded'),
      'started', COUNT(e.id) FILTER (WHERE e.event_type = 'started'),
      'completed', COUNT(e.id) FILTER (WHERE e.event_type = 'completed'),
      'error', COUNT(e.id) FILTER (WHERE e.event_type = 'error'),
      'pivot', COUNT(e.id) FILTER (WHERE e.event_type = 'pivot')
    ),
    'example_event_ids', COALESCE(jsonb_agg(e.id) FILTER (WHERE e.id IS NOT NULL) -> 0, '[]'::jsonb)
  ) AS issues_rollup
FROM artifact_days ad
LEFT JOIN code_ops.artifact_events e
  ON e.artifact_type = ad.artifact_type
 AND e.artifact_name = ad.name
 AND e.artifact_version = ad.version_hash
 AND e.timestamp::date = ad.day
GROUP BY ad.day, ad.artifact_type, ad.name, ad.file_path, ad.version_hash;
```

**View: `v_artifact_never_called`**

```sql
CREATE VIEW code_ops.v_artifact_never_called AS
SELECT a.*
FROM code_ops.artifacts a
LEFT JOIN code_ops.artifact_events e
  ON e.artifact_type = a.artifact_type
 AND e.artifact_name = a.name
WHERE a.is_active = TRUE
GROUP BY a.id
HAVING COUNT(e.id) = 0;
```

#### Retention / “Cut back down”

- Keep raw `artifact_events` for **30–90 days** (configurable).
- Keep views indefinitely; if performance becomes an issue, promote the view to a **materialized view** or a summary table without changing the interface you read.

### View: `skill_health`

Aggregated skill health metrics.

```sql
CREATE VIEW code_ops.skill_health AS
SELECT
  skill_name,
  COUNT(*) as total_events,

  -- Discovery metrics
  SUM(CASE WHEN was_searched_for THEN 1 ELSE 0 END) as times_searched,
  SUM(CASE WHEN was_found THEN 1 ELSE 0 END) as times_found,
  ROUND(AVG(CASE WHEN was_searched_for AND was_found THEN 1.0 ELSE 0.0 END) * 100, 1) as discovery_rate_pct,

  -- Usage metrics
  SUM(CASE WHEN was_loaded THEN 1 ELSE 0 END) as times_loaded,
  SUM(CASE WHEN was_followed THEN 1 ELSE 0 END) as times_followed,
  ROUND(AVG(CASE WHEN was_loaded AND was_followed THEN 1.0 ELSE 0.0 END) * 100, 1) as compliance_rate_pct,

  -- Effectiveness metrics
  SUM(CASE WHEN helped_task THEN 1 ELSE 0 END) as times_helped,
  ROUND(AVG(CASE WHEN was_loaded THEN (CASE WHEN helped_task THEN 1.0 ELSE 0.0 END) END) * 100, 1) as effectiveness_rate_pct,
  ROUND(AVG(rating), 2) as avg_rating,

  -- Time range
  MIN(timestamp) as first_seen,
  MAX(timestamp) as last_seen

FROM code_ops.skill_events
GROUP BY skill_name;
```

### View: `codebase_health_daily`

Daily rollup of codebase health.

```sql
CREATE VIEW code_ops.codebase_health_daily AS
SELECT
  DATE(created_at) as date,
  app,
  COUNT(*) FILTER (WHERE error_type = 'build' AND status = 'open') as open_build_errors,
  COUNT(*) FILTER (WHERE error_type = 'lint' AND status = 'open') as open_lint_errors,
  COUNT(*) FILTER (WHERE error_type = 'test' AND status = 'open') as open_test_failures,
  COUNT(*) FILTER (WHERE status = 'fixed' AND DATE(fixed_at) = DATE(created_at)) as fixed_today
FROM code_ops.quality_issues
GROUP BY DATE(created_at), app;
```

### View: `pivot_insights`

Aggregated insights from pivot learnings.

```sql
CREATE VIEW code_ops.pivot_insights AS
SELECT
  failure_type,
  COUNT(*) as total_pivots,
  SUM(CASE WHEN new_approach_worked THEN 1 ELSE 0 END) as successful_pivots,
  ROUND(AVG(CASE WHEN new_approach_worked THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate_pct,
  (
    SELECT array_agg(DISTINCT tag)
    FROM (
      SELECT unnest(pl2.applies_to) AS tag
      FROM code_ops.pivot_learnings pl2
      WHERE pl2.failure_type = pl.failure_type
        AND pl2.applies_to IS NOT NULL
    ) tags
  ) AS common_tags
FROM code_ops.pivot_learnings pl
GROUP BY failure_type;
```

---

## New Claude Code Components

### New Skills

#### 1. `error-registry-skill.md`

Interface with the code_ops database.

**Capabilities:**
- Connect to GG-Mac Studio Supabase at `gg-macstudio:6010`
- Write issues to `quality_issues`
- Claim issues for fixing (with 6-hour expiry)
- Mark issues as fixed
- Query issue statistics

#### 2. `pivot-learning-skill.md`

**This skill should be included in ALL other skills, agents, and commands.**

Records when an agent tries something that doesn't work and needs to change approach.

**When to Record:**
- You try a fix and it doesn't compile/lint/pass tests
- You use a tool and it fails
- You realize your approach won't work and need a different strategy
- You learn something that would help future attempts

**Capabilities:**
- Record pivot to `pivot_learnings` table
- Query past pivots for similar situations
- Tag learnings for searchability

**Integration Pattern:**
```markdown
## Pivot Learning (Required)

When something fails or doesn’t work as expected, every skill/agent/command must record evaluation data:

- Always write a `skill_events` row:
  - Set `command_name` (if applicable), `skill_name`, `skill_version`, `command_version`
  - Set `helped_task = false` and `rating = 1` when the guidance didn’t help or the step failed
  - Put the failure details in `notes`

- If you attempted a concrete fix/change, also write a `fix_attempts` row:
  - `succeeded = false`, `verified = false`
  - Put the failure details in `failure_reason`

- If you change approach (pivot), also write a `pivot_learnings` row:
  - Include: what you tried, why it failed, new approach, lesson learned
  - Tag with relevant categories (typescript, eslint, testing, etc.)

This data is how we evaluate and continuously improve (and ultimately trust) skills, agents, and commands.
```

### New Agents

#### 1. `error-scanner-agent.md`

Scans codebase and populates error registry.

**Workflow:**
1. Run `npm run build` for specified apps
2. Run `npm run lint` for specified apps
3. Run `npm run test` for specified apps
4. Parse outputs into structured issues (see Appendix B)
5. Categorize by priority and auto-fixability
6. Write to `quality_issues` table
7. Create `scan_runs` record
8. Display summary dashboard

**Trigger:** `/scan-errors` command or via `/monitor`

#### 2. `quality-fixer-agent.md` (Coordinator)

Main agent that coordinates parallel fixing.

**Workflow:**
1. Query open issues grouped by file
2. Spawn 3-4 fixer sub-agents, each assigned specific files
3. Display progress dashboard after each file assignment
4. When a sub-agent completes a file, reassign to next file
5. Continue until all files processed
6. Run final verification scan

**Dashboard Display (shown after each reassignment):**
```
Quality Fix Progress:
┌─────────────┬───────┬──────┬───────┬─────────┐
│ App         │ Build │ Lint │ Tests │ In Work │
├─────────────┼───────┼──────┼───────┼─────────┤
│ api         │ 0     │ 42   │ 0     │ 3 files │
│ web         │ 0     │ 0    │ 0     │ -       │
│ langgraph   │ 0     │ 15   │ 0     │ 1 file  │
│ orch-flow   │ 2     │ 8    │ 1     │ -       │
│ notebook    │ 0     │ 5    │ 0     │ -       │
└─────────────┴───────┴──────┴───────┴─────────┘
Agents: [Agent-1: api/service.ts] [Agent-2: api/controller.ts] [Agent-3: langgraph/workflow.ts]
```

#### 3. `file-fixer-agent.md` (Sub-agent)

Fixes all issues in a single file. Spawned by quality-fixer-agent.

**Workflow:**
1. Receive file assignment from coordinator
2. Claim all issues for that file
3. Fix issues in priority order (critical > high > medium > low)
4. Try auto-fix first for auto-fixable lint errors
5. Verify each fix
6. **Record pivots when approach doesn't work**
7. Mark issues as fixed or record failure
8. Report back to coordinator

#### 4. `claude-code-improver-agent.md` (Future Phase)

Uses pivot learnings and skill events to improve the ecosystem.

**Workflow:**
1. Query `pivot_insights` for patterns
2. Query `skill_health` for poorly performing skills
3. Analyze common failure patterns
4. Propose improvements
5. Work with human to approve changes
6. Make edits to skills/agents/commands
7. Track if improvements helped

### New Commands

#### `/scan-errors [app]`

Runs error-scanner-agent to populate registry.

```bash
/scan-errors          # Scan all apps
/scan-errors api      # Scan only API
/scan-errors web      # Scan only web
```

#### `/fix-errors [type] [app]`

Spawns quality-fixer-agent to coordinate parallel fixing.

```bash
/fix-errors                    # Fix all errors, all apps
/fix-errors build              # Fix only build errors
/fix-errors lint api           # Fix lint errors in API only
```

#### `/quality-status`

Shows current state of error registry.

```
Quality Status:
┌─────────────┬───────┬──────┬───────┬───────┐
│ App         │ Build │ Lint │ Tests │ Total │
├─────────────┼───────┼──────┼───────┼───────┤
│ api         │ 0     │ 799  │ 0     │ 799   │
│ web         │ 0     │ 0    │ 0     │ 0     │
│ langgraph   │ 0     │ 59   │ 0     │ 59    │
│ orch-flow   │ 2     │ 15   │ 3     │ 20    │
│ notebook    │ 0     │ 12   │ 0     │ 12    │
└─────────────┴───────┴──────┴───────┴───────┘

By Priority:
- Critical: 2
- High: 45
- Medium: 812
- Low: 31
```

#### `/skill-health`

Shows skill analytics from evaluation data.

```
Skill Health Report:
┌─────────────────────────┬───────────┬────────────┬─────────────┐
│ Skill                   │ Discovery │ Compliance │ Helped Task │
├─────────────────────────┼───────────┼────────────┼─────────────┤
│ api-architecture-skill  │ 98%       │ 85%        │ 92%         │
│ web-testing-skill       │ 95%       │ 78%        │ 88%         │
│ transport-types-skill   │ 72%       │ 65%        │ 70%         │ <- Needs work
└─────────────────────────┴───────────┴────────────┴─────────────┘
```

### Integration with `/monitor`

The `/monitor` command should be extended to include quality scanning:

```bash
/monitor api          # Now also runs build, lint, test for API
/monitor web          # Now also runs build, lint, test for web
/monitor              # Full codebase monitoring + quality scan
```

This integrates quality tracking into the existing monitoring workflow rather than requiring separate commands.

---

## Implementation Phases

### Phase 1: Foundation (Sequential)

**Goal:** Database schema + basic scanning

1. Create `code_ops` schema on GG-Mac Studio Supabase
2. Create all tables and views
3. Create `error-registry-skill.md`
4. Create `error-scanner-agent.md`
5. Create `/scan-errors` command
6. Test: Run scan, verify issues in database

**Phase 1 scope guardrail (recommended):**
- Implement **inventory + event stream + views first** so we can immediately answer “never called” and get trust telemetry:
  - `code_ops.artifacts`
  - `code_ops.artifact_events`
  - `code_ops.v_artifact_daily_summary`
  - `code_ops.v_artifact_never_called`
- Then iterate into richer scanning/parsing and deeper issue population.

**Deliverables:**
- [ ] Migration file for schema
- [ ] `code_ops.artifacts` population (inventory scan + UPSERT)
- [ ] `code_ops.artifact_events` logging for calls/failures
- [ ] `code_ops.v_artifact_daily_summary` + `code_ops.v_artifact_never_called` views
- [ ] error-registry-skill.md
- [ ] error-scanner-agent.md
- [ ] /scan-errors command

### Phase 2: Parallel Fixing (Sequential, after Phase 1)

**Goal:** Multiple agents fix issues from queue by file

1. Create `quality-fixer-agent.md` (coordinator)
2. Create `file-fixer-agent.md` (worker)
3. Create `/fix-errors` command
4. Implement progress dashboard
5. Test: Run fixers in parallel, verify no conflicts

**Deliverables:**
- [ ] quality-fixer-agent.md
- [ ] file-fixer-agent.md
- [ ] /fix-errors command
- [ ] Progress dashboard display

### Phase 3: Pivot Learning (Sequential, after Phase 2)

**Goal:** Agents record learning when they pivot

1. Create `pivot-learning-skill.md`
2. Update file-fixer-agent to use pivot skill
3. Create `/pivot-report` command (optional)
4. Test: Verify pivots recorded during fixing

**Deliverables:**
- [ ] pivot-learning-skill.md
- [ ] Updated agent definitions
- [ ] Pivot insights view working

### Phase 4: Monitor Integration (Sequential, after Phase 3)

**Goal:** Quality scanning integrated into /monitor

1. Extend `/monitor` to include quality scanning
2. Create unified dashboard
3. Test: `/monitor api` runs all checks

**Deliverables:**
- [ ] Updated /monitor command
- [ ] Unified quality + monitoring dashboard

### Phase 5: Continuous Improvement (Ongoing)

**Goal:** Use data to improve ecosystem

1. Create `claude-code-improver-agent.md`
2. Establish review cadence
3. Track improvements over time
4. Build feedback loop

**Deliverables:**
- [ ] claude-code-improver-agent.md
- [ ] Improvement workflow documented
- [ ] First round of data-driven improvements

---

## Success Criteria

### Phase 1 Complete When:
- Can run `/scan-errors` and see issues in database
- Issues include app, file, line, error type, message, priority
- Artifact inventory populated (`code_ops.artifacts` has skills, agents, commands)
- `v_artifact_never_called` view returns artifacts with zero events
- `v_artifact_daily_summary` view shows daily call/error counts per artifact

### Phase 2 Complete When:
- Can run `/fix-errors` and have 3-4 agents work in parallel
- Agents assigned by file (no conflicts)
- Progress dashboard displays after each reassignment
- Fixed issues marked in database

### Phase 3 Complete When:
- Pivots recorded when agents change approach
- Can query pivot insights
- Learning captured for future use

### Phase 4 Complete When:
- `/monitor api` runs build, lint, test
- Results flow to quality_issues table

### Phase 5 Complete When:
- Made at least one data-driven improvement
- Improvement measurably helped metrics

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database connection issues from Claude Code | High | Test thoroughly, add retry logic |
| Agents conflict on same files | Medium | File-based assignment from coordinator |
| Stale claims block work | Medium | 6-hour claim expiry with auto-release |
| Fixes introduce new errors | Low | Next scan catches them, iterative process |
| Pivot recording adds overhead | Low | Keep it lightweight, only on actual pivots |
| Skills change faster than data | Medium | Version tracking in skill_events |

---

## Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Scheduled scans? | No, manual trigger | Run periodically as needed |
| Git integration? | No auto-commit/PR | Manual review preferred |
| Notifications? | No | Dashboard sufficient for now |
| Historical retention? | 90 days | Balance storage vs. trend analysis |
| Multi-developer? | Future consideration | Single-developer focus for now |

---

## Appendix A: Example Queries

### Find most problematic files

```sql
SELECT file_path, COUNT(*) as issue_count
FROM code_ops.quality_issues
WHERE status = 'open'
GROUP BY file_path
ORDER BY issue_count DESC
LIMIT 10;
```

### Issues by priority

```sql
SELECT
  priority,
  COUNT(*) as total,
  SUM(CASE WHEN is_auto_fixable THEN 1 ELSE 0 END) as auto_fixable
FROM code_ops.quality_issues
WHERE status = 'open'
GROUP BY priority
ORDER BY
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END;
```

### Skills that are never found

```sql
SELECT skill_name, times_searched, times_found, discovery_rate_pct
FROM code_ops.skill_health
WHERE discovery_rate_pct < 50
ORDER BY discovery_rate_pct ASC;
```

### Most common pivot failures

```sql
SELECT
  failure_type,
  COUNT(*) as occurrences,
  array_agg(DISTINCT lesson_learned) as lessons
FROM code_ops.pivot_learnings
WHERE new_approach_worked = TRUE
GROUP BY failure_type
ORDER BY occurrences DESC;
```

### Quality trend over time

```sql
SELECT
  date,
  SUM(open_build_errors) as build,
  SUM(open_lint_errors) as lint,
  SUM(open_test_failures) as test
FROM code_ops.codebase_health_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date;
```

---

## Appendix B: Error Parsing Specifications

### Build Errors (TypeScript)

**Expected Format:**
```
apps/api/src/services/foo.service.ts(42,15): error TS2352: Type 'string' is not assignable to type 'number'.
```

**Parsing Rules:**
- File path: Everything before `(`
- Line number: First number in parentheses
- Column number: Second number in parentheses (after comma)
- Error code: `TS####` pattern
- Message: Everything after `: error TS####: `

**Multi-line Errors:**
```
apps/api/src/services/foo.service.ts(42,15): error TS2352:
  Type 'string' is not assignable to type 'number'.
    Type 'string' is not assignable to type 'number'.
```
- Collect all indented lines following the error as part of the message
- Stop at next file path or blank line

### Lint Errors (ESLint)

**Expected Format:**
```
/path/to/file.ts
  42:15  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  43:1   warning  Missing return type on function          @typescript-eslint/explicit-function-return-type
```

**Parsing Rules:**
- File path: Line with no leading whitespace ending in `.ts` or `.tsx`
- Line number: First number before `:`
- Column number: Second number after first `:`
- Severity: `error` or `warning`
- Message: Text between severity and rule name
- Rule name: Last token (typically `@typescript-eslint/...` or `eslint/...`)

**Auto-Fixable Detection:**
- Track rules known to be auto-fixable: `indent`, `semi`, `quotes`, `comma-dangle`, etc.
- Set `is_auto_fixable = TRUE` for these rules

**Edge Cases:**
- Some lint errors span multiple lines (rare) - capture full message
- File paths may contain spaces (quote them when querying)

### Test Failures (Jest)

**Expected Format:**
```
FAIL apps/api/src/services/foo.service.spec.ts
  ● FooService › should calculate correctly

    expect(received).toBe(expected) // Object.is equality

    Expected: 42
    Received: 41

      15 |     const result = service.calculate(input);
      16 |     expect(result).toBe(42);
         |                    ^
      17 |   });

      at Object.<anonymous> (apps/api/src/services/foo.service.spec.ts:16:20)
```

**Parsing Rules:**
- File path: Line starting with `FAIL ` - extract path after `FAIL `
- Test name: Line starting with `● ` - full test path including describe blocks
- Line number: From stack trace - `at Object.<anonymous> (file:line:col)`
- Message: Lines between test name and stack trace
- Error type: First line of message (e.g., `expect(received).toBe(expected)`)

**Multi-test Failures:**
- Same file may have multiple `●` blocks
- Create separate issue for each test failure

**Categorization:**
| Pattern | Category | Priority |
|---------|----------|----------|
| `TS2352`, `TS2345` | type-error | high |
| `TS7006` | implicit-any | medium |
| `no-explicit-any` | explicit-any | medium |
| `no-unused-vars` | unused-var | low |
| `indent`, `semi` | formatting | low |
| Test failure | test-failure | high |
| Build fail (any) | build-error | critical |
