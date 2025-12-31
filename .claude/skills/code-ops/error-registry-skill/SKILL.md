---
name: error-registry-skill
description: "Patterns for interacting with the code_ops database schema for quality issue tracking, error scanning, parallel fixing, and artifact inventory. Use when scanning for errors, fixing quality issues, claiming issues, tracking scan runs, managing artifact inventory, or querying quality metrics. Keywords: quality issues, error registry, scan runs, fix attempts, claim issues, artifact inventory, database operations, psql, docker exec."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
category: "code-ops"
type: "database-operations"
used-by-agents: ["error-scanner-agent", "quality-fixer-agent", "file-fixer-agent"]
related-skills: ["supabase-management-skill", "codebase-monitoring-skill"]
---

# Error Registry Skill

Patterns for interacting with the code_ops database schema for the Claude Code Quality Swarm system. This skill enables agents to track quality issues, claim work atomically, record fixes, manage artifact inventory, and query quality metrics.

## Purpose

This skill enables agents to:
1. **Connect to Database**: Use Docker exec to run psql commands against GG-Mac Studio Supabase
2. **UPSERT Quality Issues**: Write/update issues with fingerprint-based deduplication
3. **Claim Issues**: Atomically claim issues for fixing with auto-expiry
4. **Track Fixes**: Mark issues as fixed and record fix approaches
5. **Manage Artifacts**: Inventory skills, agents, and commands
6. **Query Metrics**: Get issue statistics and health dashboards

## When to Use

- **Scanning for Errors**: When running build/lint/test and need to store results
- **Fixing Issues**: When claiming issues to work on them
- **Tracking Progress**: When marking issues as fixed
- **Artifact Inventory**: When scanning .claude/ directory for artifacts
- **Health Metrics**: When querying quality status

## Database Connection

### Connection Details

- **Host**: localhost (via Docker container)
- **Port**: 6012 (mapped to container port 5432)
- **Container**: `supabase_db_api-dev`
- **Database**: `postgres`
- **User**: `postgres`
- **Schema**: `code_ops`

### Docker Exec Pattern

Since psql is not installed locally, ALL database operations must use Docker exec:

**Single-line SQL:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "SELECT COUNT(*) FROM code_ops.quality_issues WHERE status = 'open';"
```

**Multi-line SQL:**
```bash
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
SELECT app, COUNT(*) as issue_count
FROM code_ops.quality_issues
WHERE status = 'open'
GROUP BY app
ORDER BY issue_count DESC;
EOF
```

**SQL from file:**
```bash
docker exec -i supabase_db_api-dev psql -U postgres -d postgres < /path/to/query.sql
```

**With output formatting:**
```bash
# Expanded display
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "\x" -c "SELECT * FROM code_ops.quality_issues LIMIT 1;"

# CSV output
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "\copy (SELECT * FROM code_ops.quality_issues WHERE status = 'open') TO STDOUT WITH CSV HEADER"
```

## Core Operations

### 1. UPSERT Quality Issues

**Pattern**: Use fingerprint-based deduplication to prevent duplicate issues across scans.

**Fingerprint Calculation:**
- Fingerprint = SHA256 hash of: `app|file_path|error_type|error_code|message|line_number|column_number`
- Normalize values before hashing (trim whitespace, lowercase where appropriate)
- Use consistent delimiters

**Example - Calculate Fingerprint:**
```bash
# Bash example
app="web"
file_path="src/components/Example.vue"
error_type="lint"
error_code="@typescript-eslint/no-explicit-any"
message="Unexpected any. Specify a different type."
line_number="42"
column_number="10"

# Create fingerprint string
fingerprint_string="${app}|${file_path}|${error_type}|${error_code}|${message}|${line_number}|${column_number}"

# Hash it
fingerprint=$(echo -n "$fingerprint_string" | shasum -a 256 | cut -d' ' -f1)
echo "Fingerprint: $fingerprint"
```

**UPSERT SQL:**
```sql
INSERT INTO code_ops.quality_issues (
  app,
  file_path,
  line_number,
  column_number,
  issue_fingerprint,
  error_type,
  error_code,
  rule_name,
  message,
  severity,
  priority,
  is_auto_fixable,
  error_category,
  scan_id,
  last_seen_at,
  status
) VALUES (
  'web',
  'src/components/Example.vue',
  42,
  10,
  'abc123def456...', -- fingerprint
  'lint',
  '@typescript-eslint/no-explicit-any',
  'no-explicit-any',
  'Unexpected any. Specify a different type.',
  'error',
  'medium',
  false,
  'type-error',
  'scan-uuid-here',
  NOW(),
  'open'
)
ON CONFLICT (issue_fingerprint) DO UPDATE SET
  last_seen_at = NOW(),
  scan_id = EXCLUDED.scan_id,
  -- If issue was previously fixed and now seen again, re-open it
  status = CASE
    WHEN quality_issues.status = 'fixed' THEN 'open'
    ELSE quality_issues.status
  END,
  updated_at = NOW();
```

**Batch UPSERT Example:**
```bash
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
BEGIN;

INSERT INTO code_ops.quality_issues (
  app, file_path, line_number, column_number, issue_fingerprint,
  error_type, error_code, message, severity, priority,
  is_auto_fixable, scan_id, last_seen_at, status
) VALUES
  ('web', 'src/App.vue', 10, 5, 'fp1', 'lint', 'no-unused-vars', 'x is unused', 'error', 'low', true, 'scan-123', NOW(), 'open'),
  ('web', 'src/App.vue', 20, 8, 'fp2', 'build', 'TS2345', 'Type error', 'error', 'high', false, 'scan-123', NOW(), 'open'),
  ('api', 'src/main.ts', 5, 12, 'fp3', 'lint', 'no-console', 'Unexpected console', 'warning', 'low', true, 'scan-123', NOW(), 'open')
ON CONFLICT (issue_fingerprint) DO UPDATE SET
  last_seen_at = NOW(),
  scan_id = EXCLUDED.scan_id,
  status = CASE
    WHEN quality_issues.status = 'fixed' THEN 'open'
    ELSE quality_issues.status
  END,
  updated_at = NOW();

COMMIT;
EOF
```

### 2. Claim Issues for Fixing

**Pattern**: Use atomic claim function to prevent race conditions.

**Claim All Issues for a File:**
```sql
SELECT code_ops.claim_issues_for_file(
  'src/components/Example.vue',  -- file_path
  'agent-session-abc123'          -- claimed_by (agent session ID)
);
-- Returns: number of issues claimed
```

**Bash Example:**
```bash
# Generate unique session ID for this agent run
agent_session_id="agent-$(date +%s)-$$"

# Claim all issues for a file
claimed_count=$(docker exec supabase_db_api-dev psql -U postgres -d postgres -t -c \
  "SELECT code_ops.claim_issues_for_file('src/components/Example.vue', '$agent_session_id');")

echo "Claimed $claimed_count issues"
```

**Query Claimed Issues:**
```sql
SELECT id, error_type, error_code, message, line_number, priority
FROM code_ops.quality_issues
WHERE file_path = 'src/components/Example.vue'
  AND status = 'claimed'
  AND claimed_by = 'agent-session-abc123'
ORDER BY
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  line_number;
```

**Release Stale Claims:**
```sql
-- Automatically release claims older than 6 hours
SELECT code_ops.release_stale_claims();
-- Returns: number of claims released
```

### 3. Mark Issues as Fixed

**Pattern**: Update status and record fix details.

**Mark Single Issue Fixed:**
```sql
UPDATE code_ops.quality_issues
SET
  status = 'fixed',
  fixed_at = NOW(),
  fix_approach = 'Replaced any with string type',
  fix_commit = 'abc123def456'
WHERE id = 'issue-uuid-here';
```

**Mark Multiple Issues Fixed (batch):**
```sql
UPDATE code_ops.quality_issues
SET
  status = 'fixed',
  fixed_at = NOW(),
  fix_approach = 'Applied ESLint --fix to entire file'
WHERE file_path = 'src/components/Example.vue'
  AND status = 'claimed'
  AND claimed_by = 'agent-session-abc123'
  AND is_auto_fixable = true;
```

**Record Fix Attempt:**
```sql
INSERT INTO code_ops.fix_attempts (
  issue_id,
  scan_id,
  approach,
  diff,
  succeeded,
  verified,
  verification_output
) VALUES (
  'issue-uuid-here',
  'scan-uuid-here',
  'Replaced any with string type',
  '- x: any\n+ x: string',
  true,
  true,
  'Lint passed, build passed'
);
```

### 4. Create Scan Run

**Pattern**: Create scan_run record to track each scan execution.

**Create Scan Run:**
```sql
INSERT INTO code_ops.scan_runs (
  scan_type,
  apps_scanned,
  repo,
  branch,
  commit_sha,
  is_dirty,
  runner_id,
  os,
  node_version,
  package_manager,
  package_manager_version,
  scanner_version,
  triggered_by
) VALUES (
  'full',
  ARRAY['api', 'web', 'langgraph'],
  'orchestrator-ai-v2',
  'main',
  'abc123def456',
  false,
  'gg-macstudio',
  'darwin',
  'v20.11.0',
  'pnpm',
  '8.15.0',
  'error-scanner-agent-v1.0',
  'manual'
)
RETURNING id;
```

**Update Scan Run with Results:**
```sql
UPDATE code_ops.scan_runs
SET
  completed_at = NOW(),
  build_errors_found = 5,
  lint_errors_found = 42,
  test_failures_found = 3,
  total_issues = 50,
  new_issues = 12,
  fixed_since_last = 8,
  duration_ms = 45000
WHERE id = 'scan-uuid-here';
```

### 5. Artifact Inventory

**Pattern**: Scan .claude/ directory and UPSERT artifacts with version hashing.

**Calculate Artifact Hash:**
```bash
# Hash file contents for versioning
file_path=".claude/skills/error-registry-skill/SKILL.md"
version_hash=$(shasum -a 256 "$file_path" | cut -d' ' -f1)
echo "Version hash: $version_hash"
```

**UPSERT Artifact:**
```sql
INSERT INTO code_ops.artifacts (
  artifact_type,
  name,
  file_path,
  version_hash,
  first_seen_at,
  last_seen_at,
  is_active
) VALUES (
  'skill',
  'error-registry-skill',
  '.claude/skills/code-ops/error-registry-skill/SKILL.md',
  'abc123def456...',
  NOW(),
  NOW(),
  true
)
ON CONFLICT (artifact_type, name, version_hash) DO UPDATE SET
  last_seen_at = NOW(),
  is_active = true;
```

**Batch Artifact Scan:**
```bash
# Scan all skills
for skill_file in .claude/skills/**/SKILL.md; do
  skill_name=$(basename $(dirname "$skill_file"))
  version_hash=$(shasum -a 256 "$skill_file" | cut -d' ' -f1)

  docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
INSERT INTO code_ops.artifacts (artifact_type, name, file_path, version_hash, last_seen_at, is_active)
VALUES ('skill', '$skill_name', '$skill_file', '$version_hash', NOW(), true)
ON CONFLICT (artifact_type, name, version_hash) DO UPDATE SET last_seen_at = NOW(), is_active = true;
EOF
done
```

**Log Artifact Event:**
```sql
INSERT INTO code_ops.artifact_events (
  run_id,
  scan_id,
  artifact_type,
  artifact_name,
  artifact_version,
  event_type,
  success,
  issue_count,
  details
) VALUES (
  'run-uuid-here',
  'scan-uuid-here',
  'agent',
  'error-scanner-agent',
  'abc123def456',
  'completed',
  true,
  50,
  '{"duration_ms": 45000, "apps_scanned": ["api", "web"]}'::jsonb
);
```

### 6. Query Helpers

**Get Open Issues by App:**
```sql
SELECT app, COUNT(*) as issue_count,
  COUNT(*) FILTER (WHERE priority = 'critical') as critical,
  COUNT(*) FILTER (WHERE priority = 'high') as high,
  COUNT(*) FILTER (WHERE priority = 'medium') as medium,
  COUNT(*) FILTER (WHERE priority = 'low') as low
FROM code_ops.quality_issues
WHERE status = 'open'
GROUP BY app
ORDER BY issue_count DESC;
```

**Get Issues by File:**
```sql
SELECT file_path, COUNT(*) as issue_count,
  COUNT(*) FILTER (WHERE error_type = 'build') as build_errors,
  COUNT(*) FILTER (WHERE error_type = 'lint') as lint_errors,
  COUNT(*) FILTER (WHERE error_type = 'test') as test_failures
FROM code_ops.quality_issues
WHERE status = 'open'
  AND app = 'web'
GROUP BY file_path
ORDER BY issue_count DESC
LIMIT 20;
```

**Get Issue Counts by Priority:**
```sql
SELECT priority, COUNT(*) as count
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

**Overall Health Statistics:**
```sql
SELECT
  COUNT(*) as total_issues,
  COUNT(*) FILTER (WHERE status = 'open') as open_issues,
  COUNT(*) FILTER (WHERE status = 'claimed') as claimed_issues,
  COUNT(*) FILTER (WHERE status = 'fixing') as fixing_issues,
  COUNT(*) FILTER (WHERE status = 'fixed') as fixed_issues,
  COUNT(*) FILTER (WHERE is_auto_fixable = true AND status = 'open') as auto_fixable_open,
  ROUND(AVG(CASE WHEN status = 'fixed' THEN EXTRACT(EPOCH FROM (fixed_at - created_at)) END) / 60, 2) as avg_fix_time_minutes
FROM code_ops.quality_issues;
```

**Get Files with Most Issues (Hotspots):**
```sql
SELECT
  app,
  file_path,
  COUNT(*) as total_issues,
  COUNT(*) FILTER (WHERE priority IN ('critical', 'high')) as high_priority_count,
  COUNT(*) FILTER (WHERE is_auto_fixable = true) as auto_fixable_count,
  MAX(created_at) as latest_issue_at
FROM code_ops.quality_issues
WHERE status = 'open'
GROUP BY app, file_path
HAVING COUNT(*) >= 3
ORDER BY high_priority_count DESC, total_issues DESC
LIMIT 10;
```

**Recent Scan History:**
```sql
SELECT
  id,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds,
  scan_type,
  apps_scanned,
  total_issues,
  new_issues,
  fixed_since_last,
  triggered_by
FROM code_ops.scan_runs
ORDER BY started_at DESC
LIMIT 10;
```

**Skill Health Dashboard:**
```sql
SELECT
  skill_name,
  total_events,
  times_searched,
  times_found,
  discovery_rate_pct,
  times_loaded,
  times_followed,
  compliance_rate_pct,
  times_helped,
  effectiveness_rate_pct,
  avg_rating
FROM code_ops.skill_health
ORDER BY effectiveness_rate_pct DESC NULLS LAST
LIMIT 20;
```

**Artifact Daily Summary:**
```sql
SELECT
  artifact_type,
  name,
  day,
  call_count,
  error_count,
  pivot_count,
  avg_rating,
  last_event_at
FROM code_ops.v_artifact_daily_summary
WHERE day >= CURRENT_DATE - INTERVAL '7 days'
  AND call_count > 0
ORDER BY day DESC, call_count DESC
LIMIT 50;
```

**Never Called Artifacts:**
```sql
SELECT
  artifact_type,
  name,
  file_path,
  first_seen_at,
  EXTRACT(DAY FROM (NOW() - first_seen_at)) as days_since_created
FROM code_ops.v_artifact_never_called
ORDER BY first_seen_at ASC;
```

## Priority Mapping

When scanning errors, map to priorities:

**Critical:**
- Build errors preventing deployment
- Security vulnerabilities
- Data loss risks
- Breaking changes

**High:**
- Type errors (TypeScript)
- Failed tests
- Performance issues
- Architectural violations

**Medium:**
- Lint errors (non-auto-fixable)
- Code smells
- Maintainability issues
- Missing types

**Low:**
- Auto-fixable lint errors
- Style issues
- Documentation gaps
- Minor optimizations

## Auto-Fixable Detection

**Auto-fixable = true:**
- Lint errors with `--fix` support
- Formatting issues
- Simple type additions
- Unused import removal

**Auto-fixable = false:**
- Complex type errors
- Logic errors
- Architectural issues
- Test failures

## Error Categorization

Map errors to categories:

- `type-error` - TypeScript type errors
- `unused-var` - Unused variables/imports
- `formatting` - Code formatting issues
- `complexity` - Code complexity issues
- `security` - Security vulnerabilities
- `performance` - Performance issues
- `test-failure` - Test failures
- `build-error` - Build compilation errors

## Best Practices

1. **Always use fingerprints** for UPSERT to prevent duplicates
2. **Use atomic claim function** to prevent race conditions
3. **Release stale claims** before claiming new issues
4. **Record fix attempts** for learning and debugging
5. **Track scan runs** with full environment context
6. **Update artifact inventory** on every scan
7. **Log artifact events** for usage tracking
8. **Query views** for aggregated metrics (faster than raw tables)

## Common Workflows

### Workflow 1: Scan and Store Errors

```bash
# 1. Create scan run
scan_id=$(docker exec supabase_db_api-dev psql -U postgres -d postgres -t -c \
  "INSERT INTO code_ops.scan_runs (scan_type, apps_scanned, triggered_by)
   VALUES ('full', ARRAY['web'], 'manual') RETURNING id;" | tr -d ' ')

# 2. Run scan (example: lint)
npm run lint --prefix apps/web > /tmp/lint_output.txt 2>&1 || true

# 3. Parse output and UPSERT issues (pseudo-code)
# ... parse lint output, calculate fingerprints, generate SQL ...

# 4. Update scan run with results
docker exec supabase_db_api-dev psql -U postgres -d postgres -c \
  "UPDATE code_ops.scan_runs SET completed_at = NOW(), total_issues = 42 WHERE id = '$scan_id';"
```

### Workflow 2: Claim and Fix Issues

```bash
# 1. Generate agent session ID
agent_session="agent-$(date +%s)-$$"

# 2. Claim issues for file
file_path="src/components/Example.vue"
claimed=$(docker exec supabase_db_api-dev psql -U postgres -d postgres -t -c \
  "SELECT code_ops.claim_issues_for_file('$file_path', '$agent_session');")

echo "Claimed $claimed issues"

# 3. Get claimed issues
docker exec supabase_db_api-dev psql -U postgres -d postgres -c \
  "SELECT id, error_code, message, line_number FROM code_ops.quality_issues
   WHERE claimed_by = '$agent_session' ORDER BY priority, line_number;"

# 4. Fix issues (pseudo-code)
# ... apply fixes ...

# 5. Mark as fixed
docker exec supabase_db_api-dev psql -U postgres -d postgres -c \
  "UPDATE code_ops.quality_issues SET status = 'fixed', fixed_at = NOW()
   WHERE claimed_by = '$agent_session';"
```

### Workflow 3: Artifact Inventory Scan

```bash
# Scan all artifacts and UPSERT
for skill_file in .claude/skills/**/SKILL.md; do
  skill_name=$(basename $(dirname "$skill_file"))
  version_hash=$(shasum -a 256 "$skill_file" | cut -d' ' -f1)

  docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
INSERT INTO code_ops.artifacts (artifact_type, name, file_path, version_hash, last_seen_at, is_active)
VALUES ('skill', '$skill_name', '$skill_file', '$version_hash', NOW(), true)
ON CONFLICT (artifact_type, name, version_hash) DO UPDATE SET last_seen_at = NOW();
EOF
done

# Query artifact summary
docker exec supabase_db_api-dev psql -U postgres -d postgres -c \
  "SELECT artifact_type, COUNT(*) FROM code_ops.artifacts WHERE is_active = true GROUP BY artifact_type;"
```

## Error Handling

**Connection Errors:**
```bash
# Check if container is running
docker ps | grep supabase_db_api-dev

# Check database is accessible
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "SELECT 1;"

# Check schema exists
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "\dn code_ops"
```

**Transaction Errors:**
```bash
# Always wrap multi-statement operations in transactions
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
BEGIN;
-- statements here
COMMIT;
EOF
```

**Large Batch Operations:**
```bash
# For large batches, use COPY or batch inserts
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
\copy code_ops.quality_issues (app, file_path, ...) FROM '/tmp/issues.csv' WITH CSV HEADER
EOF
```

## Related

- **`supabase-management-skill/`** - General Supabase patterns
- **`codebase-monitoring-skill/`** - File analysis patterns
- **`error-scanner-agent.md`** - Uses this skill to scan and store errors
- **`quality-fixer-agent.md`** - Uses this skill to coordinate fixes
- **`file-fixer-agent.md`** - Uses this skill to claim and fix issues

## Notes

- This skill is specific to the code_ops schema created for Claude Code Quality Swarm
- All operations use Docker exec since psql is not installed locally
- Fingerprinting prevents duplicate issues across repeated scans
- Claims auto-expire after 6 hours to prevent stale locks
- Views provide pre-aggregated metrics for faster queries
