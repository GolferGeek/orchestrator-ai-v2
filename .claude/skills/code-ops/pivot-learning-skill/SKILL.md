---
name: pivot-learning-skill
description: "Patterns for recording and learning from agent pivots when approaches don't work. Use when an agent tries a fix that fails, needs to change strategy, or learns something valuable for future attempts. Enables querying past pivots for similar situations and tracking what approaches worked vs failed. Keywords: pivot, learning, failed approach, change strategy, try different approach, pivot_learnings, lesson learned, failure pattern."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
category: "code-ops"
type: "database-operations"
used-by-agents: ["file-fixer-agent", "quality-fixer-agent", "error-scanner-agent"]
related-skills: ["error-registry-skill", "supabase-management-skill"]
---

# Pivot Learning Skill

Patterns for recording and learning from agent pivots when approaches don't work. This skill enables agents to record when they try something that fails, query past pivots for similar situations, and learn from historical data to improve future attempts.

## Purpose

This skill enables agents to:
1. **Record Pivots**: Log when an approach doesn't work and agent needs to change strategy
2. **Query Past Pivots**: Find similar situations from history to learn what worked/failed
3. **Tag Learnings**: Categorize pivots for searchability and pattern recognition
4. **Learn from Data**: Use pivot_insights view to identify common failure patterns
5. **Improve Over Time**: Apply lessons learned to future attempts

## When to Record a Pivot

Record a pivot when:

1. **Fix doesn't compile/lint/pass tests**: You try a fix and verification fails
2. **Tool fails**: You use Edit/Bash/etc and the tool returns an error
3. **Approach won't work**: You realize your strategy is flawed and need to change
4. **Learn something valuable**: You discover something that would help future attempts
5. **Need to retry**: You're about to try a different approach to the same problem

**DO NOT** record a pivot for:
- Expected behavior (e.g., scanning finds errors)
- Successful fixes (record those in fix_attempts)
- Minor adjustments (only record significant strategy changes)

## Database Connection

### Connection Details

- **Host**: localhost (via Docker container)
- **Port**: 6012 (mapped to container port 5432)
- **Container**: `supabase_db_api-dev`
- **Database**: `postgres`
- **Schema**: `code_ops`

### Docker Exec Pattern

Since psql is not installed locally, ALL database operations must use Docker exec:

**Single-line SQL:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "SELECT COUNT(*) FROM code_ops.pivot_learnings;"
```

**Multi-line SQL:**
```bash
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
SELECT agent_type, COUNT(*) as pivot_count
FROM code_ops.pivot_learnings
GROUP BY agent_type
ORDER BY pivot_count DESC;
EOF
```

## Core Operations

### 1. Record a Pivot

**Pattern**: Record when you try something that doesn't work and need to change approach.

**Pivot Learning Schema:**
```sql
CREATE TABLE code_ops.pivot_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  agent_type TEXT NOT NULL,        -- 'file-fixer-agent', 'quality-fixer-agent', etc.
  task_description TEXT,           -- What was being attempted
  file_path TEXT,                  -- Which file was being worked on
  issue_id UUID,                   -- Link to quality_issues

  -- What was tried
  approach_tried TEXT NOT NULL,    -- What the agent tried
  tool_used TEXT,                  -- 'Edit', 'Bash', 'Write', etc.

  -- Why it failed
  failure_type TEXT,               -- 'build-error', 'lint-error', 'test-failure', 'runtime-error', 'logic-error'
  failure_message TEXT,            -- The actual error message

  -- The pivot
  new_approach TEXT NOT NULL,      -- What the agent decided to try instead
  why_pivot TEXT,                  -- Reasoning for the change

  -- Outcome
  new_approach_worked BOOLEAN,     -- Did the new approach succeed?

  -- Learning
  lesson_learned TEXT,             -- Key takeaway for future
  applies_to TEXT[]                -- Tags: ['typescript', 'eslint', 'testing', etc.]
);
```

**Example - Record Failed Edit Attempt:**
```bash
# Context
agent_type="file-fixer-agent"
task_description="Fix TypeScript no-explicit-any error"
file_path="src/components/Example.vue"
issue_id="issue-uuid-here"

# What was tried
approach_tried="Replaced 'any' with 'string' type"
tool_used="Edit"

# Why it failed
failure_type="build-error"
failure_message="Type 'string' is not assignable to type 'number | null'"

# The pivot
new_approach="Analyze actual usage to determine correct type is 'number | null'"
why_pivot="The 'string' type was incorrect - need to examine how the variable is actually used"

# Record the pivot
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
INSERT INTO code_ops.pivot_learnings (
  agent_type,
  task_description,
  file_path,
  issue_id,
  approach_tried,
  tool_used,
  failure_type,
  failure_message,
  new_approach,
  why_pivot,
  applies_to
) VALUES (
  '$agent_type',
  '$task_description',
  '$file_path',
  '$issue_id',
  '$approach_tried',
  '$tool_used',
  '$failure_type',
  E'$failure_message',
  '$new_approach',
  '$why_pivot',
  ARRAY['typescript', 'type-inference', 'error-analysis']
);
EOF
```

**Example - Record Failed Build:**
```bash
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
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
  lesson_learned,
  applies_to
) VALUES (
  'file-fixer-agent',
  'Fix unused variable warning',
  'src/utils/helper.ts',
  'Removed variable declaration entirely',
  'Edit',
  'build-error',
  'ReferenceError: tempResult is not defined',
  'Comment out variable instead of removing, then trace its usage',
  'Variable was used elsewhere in the file - need to check all references before removing',
  'Always check for all references before removing variables',
  ARRAY['typescript', 'refactoring', 'unused-vars']
);
EOF
```

**Example - Record Failed Test:**
```bash
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
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
  lesson_learned,
  applies_to
) VALUES (
  'file-fixer-agent',
  'Fix async test failure',
  'tests/unit/api.test.ts',
  'Added await to API call but test still fails',
  'Edit',
  'test-failure',
  'Timeout: Promise did not resolve within 5000ms',
  'Mock the API call instead of making real network request',
  'Test environment does not have network access - need to use mocks for external calls',
  'Tests should not make real network calls - always mock external dependencies',
  ARRAY['testing', 'mocking', 'async', 'vitest']
);
EOF
```

### 2. Update Pivot Outcome

**Pattern**: After trying the new approach, update whether it worked.

**Mark New Approach as Successful:**
```sql
UPDATE code_ops.pivot_learnings
SET
  new_approach_worked = true,
  lesson_learned = 'Using proper TypeScript type inference by analyzing actual usage patterns'
WHERE id = 'pivot-uuid-here';
```

**Mark New Approach as Failed (need another pivot):**
```sql
UPDATE code_ops.pivot_learnings
SET
  new_approach_worked = false,
  lesson_learned = 'This approach also failed - need to consult documentation'
WHERE id = 'pivot-uuid-here';
```

**Bash Example:**
```bash
pivot_id="pivot-uuid-here"
success=true

docker exec supabase_db_api-dev psql -U postgres -d postgres -c \
  "UPDATE code_ops.pivot_learnings
   SET new_approach_worked = $success
   WHERE id = '$pivot_id';"
```

### 3. Query Past Pivots for Similar Situations

**Pattern**: Before attempting a fix, check if similar situations have been encountered before.

**Find Pivots for Similar File:**
```sql
SELECT
  id,
  created_at,
  agent_type,
  approach_tried,
  failure_type,
  failure_message,
  new_approach,
  new_approach_worked,
  lesson_learned
FROM code_ops.pivot_learnings
WHERE file_path = 'src/components/Example.vue'
ORDER BY created_at DESC
LIMIT 10;
```

**Find Pivots by Failure Type:**
```sql
SELECT
  file_path,
  approach_tried,
  new_approach,
  new_approach_worked,
  lesson_learned,
  applies_to
FROM code_ops.pivot_learnings
WHERE failure_type = 'build-error'
  AND new_approach_worked = true
ORDER BY created_at DESC
LIMIT 20;
```

**Find Pivots by Tags:**
```sql
SELECT
  task_description,
  approach_tried,
  failure_message,
  new_approach,
  lesson_learned
FROM code_ops.pivot_learnings
WHERE applies_to && ARRAY['typescript', 'type-inference']  -- Overlaps with tags
  AND new_approach_worked = true
ORDER BY created_at DESC
LIMIT 10;
```

**Bash Example - Query Before Fixing:**
```bash
# Before attempting a TypeScript fix, check past pivots
file_path="src/components/Example.vue"

echo "=== Checking past pivots for $file_path ==="
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
SELECT
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as when,
  approach_tried,
  failure_type,
  new_approach,
  new_approach_worked,
  lesson_learned
FROM code_ops.pivot_learnings
WHERE file_path = '$file_path'
  OR applies_to && ARRAY['typescript']
ORDER BY created_at DESC
LIMIT 5;
EOF
```

### 4. Query Pivot Insights (Aggregated Patterns)

**Pattern**: Use the pivot_insights view to identify common failure patterns and successful strategies.

**View All Failure Type Patterns:**
```sql
SELECT
  failure_type,
  total_pivots,
  successful_pivots,
  success_rate_pct,
  common_tags
FROM code_ops.pivot_insights
ORDER BY total_pivots DESC;
```

**Example Output:**
```
failure_type   | total_pivots | successful_pivots | success_rate_pct | common_tags
---------------+--------------+-------------------+------------------+---------------------------
build-error    | 42           | 38                | 90.5             | {typescript,type-inference}
lint-error     | 31           | 29                | 93.5             | {eslint,auto-fix}
test-failure   | 18           | 12                | 66.7             | {testing,mocking,async}
runtime-error  | 8            | 5                 | 62.5             | {null-check,validation}
```

**Find Successful Pivot Strategies:**
```bash
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
SELECT
  failure_type,
  COUNT(*) as count,
  array_agg(DISTINCT new_approach ORDER BY new_approach) as successful_approaches
FROM code_ops.pivot_learnings
WHERE new_approach_worked = true
GROUP BY failure_type
ORDER BY count DESC;
EOF
```

**Find Common Lessons Learned:**
```bash
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
SELECT
  lesson_learned,
  COUNT(*) as times_learned,
  array_agg(DISTINCT failure_type) as failure_types
FROM code_ops.pivot_learnings
WHERE lesson_learned IS NOT NULL
  AND new_approach_worked = true
GROUP BY lesson_learned
HAVING COUNT(*) > 1
ORDER BY times_learned DESC
LIMIT 20;
EOF
```

### 5. Tag Learnings for Searchability

**Pattern**: Use consistent tags to make pivots searchable.

**Common Tag Categories:**

**Technology Tags:**
- `typescript`, `javascript`, `vue`, `react`
- `eslint`, `prettier`, `vitest`, `jest`
- `node`, `express`, `fastify`

**Problem Domain Tags:**
- `type-inference`, `type-error`, `null-check`
- `async`, `promises`, `callbacks`
- `mocking`, `testing`, `e2e`
- `import-resolution`, `module-not-found`

**Approach Tags:**
- `refactoring`, `auto-fix`, `manual-fix`
- `error-analysis`, `debugging`
- `documentation`, `research`

**Example - Multi-Tagged Pivot:**
```sql
INSERT INTO code_ops.pivot_learnings (
  agent_type,
  task_description,
  approach_tried,
  failure_type,
  new_approach,
  why_pivot,
  applies_to
) VALUES (
  'file-fixer-agent',
  'Fix async type error in API service',
  'Added Promise return type',
  'build-error',
  'Use async/await with proper Promise<T> typing',
  'Return type was incomplete - needed generic type parameter',
  ARRAY[
    'typescript',
    'async',
    'promises',
    'type-inference',
    'api-service'
  ]
);
```

## Integration Pattern for Skills/Agents/Commands

### For File-Fixer Agents

**Workflow Integration:**

1. **Before Attempting Fix**: Query past pivots for the file
2. **After Failed Fix**: Record pivot with details
3. **After Successful Fix**: Update pivot outcome
4. **After All Fixes**: Query insights to learn patterns

**Example Integration:**
```bash
# 1. Query past pivots before fixing
file_path="src/components/Example.vue"
past_pivots=$(docker exec -i supabase_db_api-dev psql -U postgres -d postgres -t -c \
  "SELECT COUNT(*) FROM code_ops.pivot_learnings WHERE file_path = '$file_path';")

if [ "$past_pivots" -gt 0 ]; then
  echo "Found $past_pivots past pivots for this file - reviewing lessons learned..."
  docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
SELECT lesson_learned, new_approach
FROM code_ops.pivot_learnings
WHERE file_path = '$file_path'
  AND new_approach_worked = true
ORDER BY created_at DESC LIMIT 3;
EOF
fi

# 2. Attempt fix
# ... try fix with Edit tool ...

# 3. If fix fails, record pivot
if [ $fix_failed ]; then
  docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
INSERT INTO code_ops.pivot_learnings (
  agent_type, task_description, file_path, approach_tried,
  failure_type, failure_message, new_approach, why_pivot, applies_to
) VALUES (
  'file-fixer-agent',
  'Fix TypeScript error',
  '$file_path',
  'Replaced any with string',
  'build-error',
  'Type error on line 42',
  'Analyze actual usage to determine type',
  'Initial type guess was wrong',
  ARRAY['typescript', 'type-inference']
) RETURNING id;
EOF
fi
```

### For Quality-Fixer Coordinator

**Workflow Integration:**

1. **After Sub-Agent Fails**: Record pivot at coordinator level
2. **Before Reassigning**: Query insights to adjust strategy
3. **After Run Completes**: Analyze pivot patterns

**Example Integration:**
```bash
# If a sub-agent reports repeated failures
sub_agent_id="fixer-1"
failure_count=3

if [ $failure_count -ge 3 ]; then
  # Record coordinator-level pivot
  docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
INSERT INTO code_ops.pivot_learnings (
  agent_type,
  task_description,
  approach_tried,
  failure_type,
  new_approach,
  why_pivot,
  applies_to
) VALUES (
  'quality-fixer-agent',
  'Parallel fixing of lint errors',
  'Assigned complex TypeScript files to basic fixer agent',
  'logic-error',
  'Route TypeScript errors to specialized type-fixer agent',
  'Basic agent lacks TypeScript expertise - need specialized routing',
  ARRAY['coordination', 'task-routing', 'typescript']
);
EOF
fi
```

### For Error-Scanner Agent

**Workflow Integration:**

1. **If Scan Fails**: Record pivot with scan context
2. **Query Tool-Specific Pivots**: Learn from past scanner issues

**Example Integration:**
```bash
# If build scan fails unexpectedly
app="web"
scan_tool="npm run build"

docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
INSERT INTO code_ops.pivot_learnings (
  agent_type,
  task_description,
  approach_tried,
  tool_used,
  failure_type,
  failure_message,
  new_approach,
  why_pivot,
  applies_to
) VALUES (
  'error-scanner-agent',
  'Scan $app for build errors',
  'Run build without clearing node_modules',
  'Bash',
  'runtime-error',
  'Module not found: @types/node',
  'Clear node_modules and reinstall before scanning',
  'Stale dependencies causing scan failures',
  ARRAY['scanning', 'dependencies', 'build-tools']
);
EOF
```

## Common Workflows

### Workflow 1: Record and Learn from Failed Fix

```bash
# Context
agent_type="file-fixer-agent"
file_path="src/services/api.ts"
issue_id="issue-uuid-here"

# 1. Query past pivots for this file
echo "=== Checking past pivots ==="
docker exec -i supabase_db_api-dev psql -U postgres -d postgres -c \
  "SELECT approach_tried, new_approach, lesson_learned
   FROM code_ops.pivot_learnings
   WHERE file_path = '$file_path' AND new_approach_worked = true
   ORDER BY created_at DESC LIMIT 3;"

# 2. Attempt fix
# ... try fix ...
fix_failed=true
failure_message="Type 'string' is not assignable to type 'number'"

# 3. Record pivot
if [ "$fix_failed" = true ]; then
  pivot_id=$(docker exec -i supabase_db_api-dev psql -U postgres -d postgres -t -c \
    "INSERT INTO code_ops.pivot_learnings (
      agent_type, task_description, file_path, issue_id,
      approach_tried, tool_used, failure_type, failure_message,
      new_approach, why_pivot, applies_to
     ) VALUES (
       '$agent_type',
       'Fix TypeScript type error',
       '$file_path',
       '$issue_id',
       'Changed type to string',
       'Edit',
       'build-error',
       E'$failure_message',
       'Analyze actual usage to determine type should be number',
       'Initial type assumption was incorrect',
       ARRAY['typescript', 'type-inference']
     ) RETURNING id;" | tr -d ' ')

  echo "Recorded pivot: $pivot_id"

  # 4. Try new approach
  # ... try new fix ...
  new_fix_success=true

  # 5. Update outcome
  docker exec supabase_db_api-dev psql -U postgres -d postgres -c \
    "UPDATE code_ops.pivot_learnings
     SET new_approach_worked = $new_fix_success,
         lesson_learned = 'Must analyze actual variable usage to infer correct types'
     WHERE id = '$pivot_id';"
fi
```

### Workflow 2: Query Insights Before Starting Work

```bash
# Before starting a batch of TypeScript fixes
echo "=== TypeScript Pivot Insights ==="
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
-- Get successful approaches for TypeScript errors
SELECT
  new_approach,
  COUNT(*) as times_successful,
  array_agg(DISTINCT lesson_learned) FILTER (WHERE lesson_learned IS NOT NULL) as lessons
FROM code_ops.pivot_learnings
WHERE applies_to && ARRAY['typescript']
  AND new_approach_worked = true
GROUP BY new_approach
ORDER BY times_successful DESC
LIMIT 10;
EOF

echo ""
echo "=== Common TypeScript Failure Patterns ==="
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
SELECT
  failure_type,
  COUNT(*) as count,
  ROUND(AVG(CASE WHEN new_approach_worked THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate
FROM code_ops.pivot_learnings
WHERE applies_to && ARRAY['typescript']
GROUP BY failure_type
ORDER BY count DESC;
EOF
```

### Workflow 3: Analyze Pivot Patterns After Batch Run

```bash
# After completing a batch of fixes
run_id="run-$(date +%s)"

echo "=== Pivot Summary for Run $run_id ==="
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
-- Count pivots by type
SELECT
  failure_type,
  COUNT(*) as total,
  SUM(CASE WHEN new_approach_worked THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN new_approach_worked = false THEN 1 ELSE 0 END) as failed
FROM code_ops.pivot_learnings
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY failure_type
ORDER BY total DESC;
EOF

echo ""
echo "=== New Lessons Learned ==="
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
SELECT
  TO_CHAR(created_at, 'HH24:MI') as time,
  file_path,
  lesson_learned
FROM code_ops.pivot_learnings
WHERE created_at >= NOW() - INTERVAL '1 hour'
  AND lesson_learned IS NOT NULL
  AND new_approach_worked = true
ORDER BY created_at DESC;
EOF
```

## Failure Type Classification

Map errors to failure types:

**build-error:**
- TypeScript compilation errors
- Module resolution errors
- Import/export errors
- Syntax errors

**lint-error:**
- ESLint rule violations
- Style issues
- Code quality warnings
- Complexity violations

**test-failure:**
- Test assertion failures
- Test timeout errors
- Mock/stub issues
- Test environment errors

**runtime-error:**
- Null/undefined errors
- Type coercion errors
- API call failures
- File system errors

**logic-error:**
- Wrong approach entirely
- Architectural issues
- Strategy doesn't work
- Misunderstanding requirements

## Best Practices

1. **Be Specific**: Record exactly what was tried and why it failed
2. **Record Reasoning**: Always include why_pivot to explain the thinking
3. **Update Outcomes**: Always update new_approach_worked after trying new approach
4. **Tag Consistently**: Use consistent tag vocabulary for searchability
5. **Query First**: Check past pivots before attempting fixes
6. **Learn from Patterns**: Regularly review pivot_insights to identify trends
7. **Document Lessons**: Write clear lesson_learned for successful pivots
8. **Link to Issues**: Include issue_id when pivot relates to quality_issues record

## Anti-Patterns to Avoid

**Don't Record:**
- Successful fixes (use fix_attempts for those)
- Expected behavior (scanning finds errors is not a pivot)
- Minor adjustments (only record significant strategy changes)
- Duplicate pivots (check if similar pivot already recorded)

**Don't Forget:**
- Updating new_approach_worked outcome
- Adding tags for searchability
- Including failure_message for debugging
- Linking to issue_id when applicable

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

**Query Errors:**
```bash
# Always escape strings with E'...' for special characters
# Use array literals: ARRAY['tag1', 'tag2']
# Use proper boolean literals: true/false (not 'true'/'false')
```

**Transaction Safety:**
```bash
# For multiple related operations, use transactions
docker exec -i supabase_db_api-dev psql -U postgres -d postgres <<EOF
BEGIN;
-- operations here
COMMIT;
EOF
```

## Related

- **`error-registry-skill/`** - Database connection patterns and issue tracking
- **`supabase-management-skill/`** - General Supabase patterns
- **`file-fixer-agent.md`** - Primary user of this skill
- **`quality-fixer-agent.md`** - Coordinator that aggregates pivot patterns
- **`error-scanner-agent.md`** - May record pivots for scan failures

## Notes

- This skill is specific to the code_ops schema created for Claude Code Quality Swarm
- All operations use Docker exec since psql is not installed locally
- Pivots are for learning - not every failed attempt needs to be recorded
- Focus on recording significant strategy changes and valuable lessons
- Query past pivots before attempting fixes to avoid repeating mistakes
- Regularly review pivot_insights to identify systemic issues
