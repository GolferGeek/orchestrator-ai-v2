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
3. **Evaluate Claude Code itself** - how well commands, agents, and skills perform
4. **Enable continuous improvement** of the Claude Code ecosystem based on evaluation data

This is **not** about Orchestrator AI agents (the product) - this is about improving the Claude Code development tooling we use to build Orchestrator AI.

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

3. **Claude Code ecosystem is a black box**
   - Don't know which skills are being found/used
   - Don't know which agents succeed/fail
   - Don't know which commands work well
   - Can't improve what we can't measure

4. **Skills/agents degrade over time**
   - Patterns become outdated
   - Keywords stop matching
   - No feedback loop for improvement

---

## Goals

### Primary Goals

1. **Centralized Error Registry**: Single source of truth for all code quality issues
2. **Parallel Auto-Fixing**: Multiple agents fix different files simultaneously
3. **Self-Evaluation**: Agents record their own performance metrics
4. **Skill Analytics**: Track skill discovery, usage, and effectiveness
5. **Continuous Improvement**: Use data to improve skills, agents, and commands

### Success Metrics

| Metric | Target |
|--------|--------|
| Time to fix all lint errors | Reduce by 50% |
| Skill discovery rate | >95% |
| Agent task success rate | >90% |
| Mean time to identify failing skill | <1 day |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GG-Mac Studio                               │
│                    (Code Operations Database)                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     code_ops schema                          │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │quality_issues│  │agent_executions│ │skill_events │       │   │
│  │  │              │  │              │  │              │       │   │
│  │  │ Build errors │  │ Command runs │  │ Discovery    │       │   │
│  │  │ Lint errors  │  │ Success/fail │  │ Usage        │       │   │
│  │  │ Test failures│  │ Self-rating  │  │ Effectiveness│       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐                         │   │
│  │  │ fix_attempts │  │codebase_health│                        │   │
│  │  │              │  │              │                         │   │
│  │  │ What was tried│ │ Daily rollup │                         │   │
│  │  │ Diffs/changes│  │ Trends       │                         │   │
│  │  └──────────────┘  └──────────────┘                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │   Scanner   │   │   Fixers    │   │  Evaluator  │
    │   Agents    │   │   Agents    │   │   Agent     │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### Database Location

**Host:** GG-Mac Studio local Supabase
**Schema:** `code_ops`
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
  app TEXT NOT NULL,              -- 'api', 'web', 'langgraph', 'orch-flow', etc.
  file_path TEXT NOT NULL,
  line_number INT,
  column_number INT,

  -- Issue details
  error_type TEXT NOT NULL,       -- 'build', 'lint', 'test'
  error_code TEXT,                -- 'TS2352', '@typescript-eslint/no-explicit-any'
  rule_name TEXT,                 -- For lint errors
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'error',  -- 'error', 'warning'

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
  CONSTRAINT valid_error_type CHECK (error_type IN ('build', 'lint', 'test'))
);

CREATE INDEX idx_quality_issues_status ON code_ops.quality_issues(status);
CREATE INDEX idx_quality_issues_app ON code_ops.quality_issues(app);
CREATE INDEX idx_quality_issues_file ON code_ops.quality_issues(file_path);
CREATE INDEX idx_quality_issues_type ON code_ops.quality_issues(error_type);
```

### Table: `scan_runs`

Tracks each time we scan for errors.

```sql
CREATE TABLE code_ops.scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- What was scanned
  scan_type TEXT NOT NULL,        -- 'full', 'incremental', 'app-specific'
  apps_scanned TEXT[],            -- ['api', 'web', 'langgraph']

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
  triggered_by TEXT               -- 'manual', 'scheduled', 'pre-commit'
);
```

### Table: `agent_executions`

Tracks Claude Code sub-agent runs for self-evaluation.

```sql
CREATE TABLE code_ops.agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- What was run
  agent_type TEXT NOT NULL,       -- 'testing-agent', 'codebase-hardening-agent'
  command TEXT,                   -- '/test api unit', '/harden apps/web'
  prompt_hash TEXT,               -- Hash of the prompt for deduplication
  prompt_summary TEXT,            -- Brief description of task

  -- Execution details
  model TEXT,                     -- 'sonnet', 'opus', 'haiku'

  -- Outcome
  completed BOOLEAN DEFAULT FALSE,
  success BOOLEAN,                -- Did it achieve the goal?
  error_message TEXT,             -- If failed, why?

  -- Performance
  duration_ms INT,
  retry_count INT DEFAULT 0,

  -- Tool usage
  tools_called JSONB,             -- [{tool: 'Edit', count: 5}, ...]
  files_read INT DEFAULT 0,
  files_edited INT DEFAULT 0,

  -- Self-assessment (agent fills this)
  self_rating INT,                -- 1-5
  confidence INT,                 -- 1-5 how confident in the result
  what_worked TEXT,
  what_failed TEXT,
  suggestions TEXT,
  learnings TEXT,                 -- What the agent learned

  CONSTRAINT valid_rating CHECK (self_rating BETWEEN 1 AND 5),
  CONSTRAINT valid_confidence CHECK (confidence BETWEEN 1 AND 5)
);

CREATE INDEX idx_agent_executions_type ON code_ops.agent_executions(agent_type);
CREATE INDEX idx_agent_executions_success ON code_ops.agent_executions(success);
CREATE INDEX idx_agent_executions_date ON code_ops.agent_executions(started_at);
```

### Table: `skill_events`

Tracks skill discovery and usage.

```sql
CREATE TABLE code_ops.skill_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  execution_id UUID REFERENCES code_ops.agent_executions(id),
  agent_type TEXT,                -- Which agent was running

  -- Skill info
  skill_name TEXT NOT NULL,       -- 'api-architecture-skill'
  skill_category TEXT,            -- 'architecture', 'testing', 'quality'

  -- Discovery phase
  was_searched_for BOOLEAN,       -- Did agent look for this skill?
  was_found BOOLEAN,              -- Was it found when searched?
  discovery_method TEXT,          -- 'keyword', 'mandatory', 'explicit', 'related'
  search_query TEXT,              -- What query was used to find it
  search_attempts INT DEFAULT 1,  -- How many searches before found

  -- Usage phase
  was_loaded BOOLEAN DEFAULT FALSE,
  was_followed BOOLEAN,           -- Did agent follow the patterns?

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
CREATE INDEX idx_skill_events_execution ON code_ops.skill_events(execution_id);
```

### Table: `fix_attempts`

Links issues to fix attempts.

```sql
CREATE TABLE code_ops.fix_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Links
  issue_id UUID REFERENCES code_ops.quality_issues(id),
  execution_id UUID REFERENCES code_ops.agent_executions(id),

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
CREATE INDEX idx_fix_attempts_execution ON code_ops.fix_attempts(execution_id);
```

### View: `skill_health`

Aggregated skill health metrics.

```sql
CREATE VIEW code_ops.skill_health AS
SELECT
  skill_name,
  COUNT(*) as total_events,
  COUNT(DISTINCT execution_id) as unique_executions,

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

---

## New Claude Code Components

### New Skills

#### 1. `error-registry-skill.md`

Interface with the code_ops database.

**Capabilities:**
- Connect to GG-Mac Studio Supabase
- Write issues to `quality_issues`
- Claim issues for fixing
- Mark issues as fixed
- Record self-evaluations
- Query issue statistics

#### 2. `self-eval-skill.md`

Template for agents to record their own performance.

**Capabilities:**
- Create execution record at task start
- Record skill lookups during execution
- Submit self-assessment at task end
- Provide structured evaluation format

### New Agents

#### 1. `error-scanner-agent.md`

Scans codebase and populates error registry.

**Workflow:**
1. Run `npm run build` for all apps
2. Run `npm run lint` for all apps
3. Run `npm run test` for all apps
4. Parse outputs into structured issues
5. Write to `quality_issues` table
6. Create `scan_runs` record

**Trigger:** `/scan-errors` command or scheduled

#### 2. `build-fixer-agent.md`

Fixes TypeScript/build errors from registry.

**Workflow:**
1. Query `quality_issues` WHERE error_type='build' AND status='open'
2. Claim issues by file (to avoid conflicts)
3. Fix TypeScript errors
4. Verify with `npm run build`
5. Mark as fixed or record failure
6. Self-evaluate

#### 3. `lint-fixer-agent.md`

Fixes ESLint errors from registry.

**Workflow:**
1. Query `quality_issues` WHERE error_type='lint' AND status='open'
2. Claim issues by file
3. Fix lint errors (proper types, not disabling rules)
4. Verify with `npm run lint`
5. Mark as fixed or record failure
6. Self-evaluate

#### 4. `test-fixer-agent.md`

Fixes failing tests from registry.

**Workflow:**
1. Query `quality_issues` WHERE error_type='test' AND status='open'
2. Claim issues by test file
3. Analyze failure, fix test or code
4. Verify with `npm test`
5. Mark as fixed or record failure
6. Self-evaluate

#### 5. `claude-code-improver-agent.md` (Phase 2)

Uses evaluation data to improve the ecosystem.

**Workflow:**
1. Query `skill_health` for poorly performing skills
2. Query `agent_executions` for common failures
3. Propose improvements
4. Work with human to approve changes
5. Make edits to skills/agents/commands
6. Track if improvements helped

### New Commands

#### `/scan-errors [app]`

Runs error-scanner-agent to populate registry.

```bash
/scan-errors          # Scan all apps
/scan-errors api      # Scan only API
/scan-errors web      # Scan only web
```

#### `/fix-errors [type] [app]`

Spawns fixer agents to fix issues from registry.

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
└─────────────┴───────┴──────┴───────┴───────┘
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
│ transport-types-skill   │ 72%       │ 65%        │ 70%         │ ← Needs work
└─────────────────────────┴───────────┴────────────┴─────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Database schema + basic scanning

1. Create `code_ops` schema on GG-Mac Studio Supabase
2. Create all tables and views
3. Create `error-registry-skill.md`
4. Create `error-scanner-agent.md`
5. Create `/scan-errors` command
6. Test: Run scan, verify issues in database

**Deliverables:**
- [ ] Migration file for schema
- [ ] error-registry-skill.md
- [ ] error-scanner-agent.md
- [ ] /scan-errors command

### Phase 2: Parallel Fixing (Week 2)

**Goal:** Multiple agents fix issues from queue

1. Create `build-fixer-agent.md`
2. Create `lint-fixer-agent.md`
3. Create `test-fixer-agent.md`
4. Create `/fix-errors` command
5. Test: Run fixers in parallel, verify coordination

**Deliverables:**
- [ ] build-fixer-agent.md
- [ ] lint-fixer-agent.md
- [ ] test-fixer-agent.md
- [ ] /fix-errors command

### Phase 3: Self-Evaluation (Week 3)

**Goal:** Agents record their own performance

1. Create `self-eval-skill.md`
2. Update existing agents to use self-eval
3. Create `/quality-status` command
4. Test: Verify evaluations recorded

**Deliverables:**
- [ ] self-eval-skill.md
- [ ] Updated agent definitions
- [ ] /quality-status command

### Phase 4: Skill Analytics (Week 4)

**Goal:** Track skill discovery and usage

1. Add skill tracking to self-eval-skill
2. Create `/skill-health` command
3. Build dashboard view (optional)
4. Identify poorly performing skills

**Deliverables:**
- [ ] Skill tracking in self-eval
- [ ] /skill-health command
- [ ] First skill health report

### Phase 5: Continuous Improvement (Ongoing)

**Goal:** Use data to improve ecosystem

1. Create `claude-code-improver-agent.md`
2. Establish review cadence (weekly?)
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
- Issues include app, file, line, error type, message

### Phase 2 Complete When:
- Can run `/fix-errors` and have multiple agents work in parallel
- Agents don't conflict on same files
- Fixed issues marked in database

### Phase 3 Complete When:
- Every agent execution creates evaluation record
- Can query success rates by agent type
- Can see self-ratings and learnings

### Phase 4 Complete When:
- Skill discovery/usage tracked
- Can identify skills with low discovery rate
- Can identify skills that don't help

### Phase 5 Complete When:
- Made at least one data-driven improvement
- Improvement measurably helped metrics

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database connection issues from Claude Code | High | Test thoroughly, add retry logic |
| Agents conflict on same files | Medium | Claim-based locking in registry |
| Self-eval adds overhead | Low | Keep eval lightweight, async |
| Too much data to analyze | Low | Start with key metrics only |
| Skills change faster than evals | Medium | Version tracking in skill_events |

---

## Open Questions

1. **Scheduled scans?** Should error scanning run automatically (e.g., hourly)?
2. **Git integration?** Should fixes auto-commit? Auto-create PRs?
3. **Notifications?** Alert when new errors introduced?
4. **Historical retention?** How long to keep evaluation data?
5. **Multi-developer?** Will this work for team scenarios?

---

## Appendix: Example Queries

### Find most problematic files

```sql
SELECT file_path, COUNT(*) as issue_count
FROM code_ops.quality_issues
WHERE status = 'open'
GROUP BY file_path
ORDER BY issue_count DESC
LIMIT 10;
```

### Agent success rate by type

```sql
SELECT
  agent_type,
  COUNT(*) as total_runs,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
  ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate
FROM code_ops.agent_executions
WHERE completed = TRUE
GROUP BY agent_type;
```

### Skills that are never found

```sql
SELECT skill_name, times_searched, times_found, discovery_rate_pct
FROM code_ops.skill_health
WHERE discovery_rate_pct < 50
ORDER BY discovery_rate_pct ASC;
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
