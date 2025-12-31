---
name: self-reporting-skill
description: "MANDATORY skill for ALL Claude Code artifacts. Every skill, agent, and command MUST log their invocation and any issues to the code_ops database. Use at the START of every task and when encountering errors. Keywords: self-report, logging, artifact events, issue tracking, mandatory, required."
allowed-tools: Bash
category: "code-ops"
type: "cross-cutting"
mandatory-for: ["all-skills", "all-agents", "all-commands"]
---

# Self-Reporting Skill (MANDATORY)

**CRITICAL: This skill MUST be followed by ALL skills, agents, and commands.**

Every Claude Code artifact must self-report:
1. When it is invoked (started)
2. When it completes (success or failure)
3. When it encounters an issue

## Why This Matters

Without self-reporting, we cannot:
- Track which artifacts are actually being used
- Identify which artifacts have issues
- Learn from failures and pivots
- Improve the Claude Code ecosystem

## Database Connection

All database operations use Docker exec:

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "SQL"
```

## MANDATORY: Log Invocation (Do This FIRST)

**Every skill/agent/command MUST log when it starts:**

```bash
# Generate a unique run ID for this invocation
RUN_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Log invocation to artifact_events
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (
  run_id,
  artifact_type,
  artifact_name,
  artifact_version,
  event_type,
  details
) VALUES (
  '$RUN_ID',
  'skill',  -- or 'agent' or 'command'
  'error-registry-skill',  -- the artifact name
  '$(shasum -a 256 .claude/skills/code-ops/error-registry-skill/SKILL.md | cut -d\" \" -f1)',
  'invoked',
  '{\"triggered_by\": \"user\", \"context\": \"description of what triggered this\"}'::jsonb
);"

echo "Logged invocation: $RUN_ID"
```

**Simplified version (copy-paste ready):**

```bash
# Log skill/agent/command invocation
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, artifact_version, event_type)
VALUES ('skill', 'SKILL_NAME_HERE', 'unknown', 'invoked');"
```

## MANDATORY: Log Completion

**Every skill/agent/command MUST log when it completes:**

```bash
# Log successful completion
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (
  run_id,
  artifact_type,
  artifact_name,
  artifact_version,
  event_type,
  success,
  details
) VALUES (
  '$RUN_ID',
  'skill',
  'error-registry-skill',
  'version-hash',
  'completed',
  true,
  '{\"duration_ms\": 1500, \"outcome\": \"description\"}'::jsonb
);"
```

**On failure:**

```bash
# Log failed completion
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (
  run_id,
  artifact_type,
  artifact_name,
  artifact_version,
  event_type,
  success,
  details
) VALUES (
  '$RUN_ID',
  'skill',
  'error-registry-skill',
  'version-hash',
  'error',
  false,
  '{\"error\": \"Description of what went wrong\"}'::jsonb
);"
```

## MANDATORY: Log Issues Encountered

**When an artifact encounters an issue during execution, log it:**

```bash
# Log an issue to quality_issues
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.quality_issues (
  app,
  file_path,
  line_number,
  issue_fingerprint,
  error_type,
  error_code,
  message,
  severity,
  priority,
  status
) VALUES (
  'api',  -- or 'web', 'langgraph', etc.
  'path/to/file.ts',
  42,
  md5('api|path/to/file.ts|lint|rule-name|message|42'),
  'lint',  -- or 'build', 'test'
  'rule-name',
  'Error message here',
  'error',
  'medium',
  'open'
) ON CONFLICT (issue_fingerprint) DO UPDATE SET
  last_seen_at = NOW(),
  status = CASE WHEN code_ops.quality_issues.status = 'fixed' THEN 'open' ELSE code_ops.quality_issues.status END;"
```

## MANDATORY: Log Pivots (When Changing Approach)

**When an artifact tries something that fails and needs to change approach:**

```bash
# Log a pivot learning
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.pivot_learnings (
  agent_type,
  task_description,
  file_path,
  approach_tried,
  tool_used,
  failure_type,
  failure_message,
  new_approach,
  why_pivot,
  applies_to
) VALUES (
  'file-fixer-agent',
  'What I was trying to do',
  'path/to/file.ts',
  'What I tried',
  'Edit',  -- or 'Bash', etc.
  'build-error',  -- or 'lint-error', 'test-failure', 'runtime-error', 'logic-error'
  'The error message I got',
  'What I will try instead',
  'Why I think the new approach will work',
  ARRAY['typescript', 'eslint']  -- relevant tags
);"
```

## Quick Reference: Event Types

| Event Type | When to Use |
|------------|-------------|
| `invoked` | Artifact is starting execution |
| `loaded` | Skill was loaded/read by an agent |
| `started` | Long-running task is beginning |
| `completed` | Artifact finished successfully |
| `error` | Artifact finished with error |
| `pivot` | Agent changed approach mid-task |

## Quick Reference: Issue Types

| Error Type | When to Use |
|------------|-------------|
| `build` | TypeScript compilation errors |
| `lint` | ESLint errors/warnings |
| `test` | Jest test failures |

## Quick Reference: Failure Types (for pivots)

| Failure Type | When to Use |
|--------------|-------------|
| `build-error` | Code doesn't compile |
| `lint-error` | Lint rules violated |
| `test-failure` | Tests don't pass |
| `runtime-error` | Code crashes at runtime |
| `logic-error` | Code runs but does wrong thing |

## Example: Complete Self-Reporting Flow

```bash
# 1. START - Log invocation
RUN_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type)
VALUES ('$RUN_ID', 'agent', 'file-fixer-agent', 'v1', 'invoked');"

# 2. DO WORK...
# ... agent does its thing ...

# 3. IF ISSUE FOUND - Log it
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.quality_issues (app, file_path, issue_fingerprint, error_type, message, status)
VALUES ('api', 'src/auth.ts', md5('api|src/auth.ts|lint|error|42'), 'lint', 'Unused variable', 'open')
ON CONFLICT (issue_fingerprint) DO UPDATE SET last_seen_at = NOW();"

# 4. IF PIVOT NEEDED - Log it
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.pivot_learnings (agent_type, approach_tried, failure_type, new_approach, applies_to)
VALUES ('file-fixer-agent', 'Remove variable', 'lint-error', 'Check if variable is used elsewhere', ARRAY['typescript']);"

# 5. END - Log completion
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type, success)
VALUES ('$RUN_ID', 'agent', 'file-fixer-agent', 'v1', 'completed', true);"
```

## How to Add Self-Reporting to an Artifact

1. Add `self-reporting-skill` to the artifact's `mandatory-skills` list
2. At the START of the artifact's workflow, add the invocation logging
3. At the END of the artifact's workflow, add the completion logging
4. Whenever an issue is encountered, add issue logging
5. Whenever a pivot is needed, add pivot logging

## Checking If Self-Reporting Is Working

Query recent events:

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT artifact_type, artifact_name, event_type, success, timestamp
FROM code_ops.artifact_events
ORDER BY timestamp DESC
LIMIT 10;"
```

Query issues logged:

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
SELECT app, file_path, error_type, message, status
FROM code_ops.quality_issues
ORDER BY created_at DESC
LIMIT 10;"
```
