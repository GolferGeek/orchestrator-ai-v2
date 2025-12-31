---
description: "Display pivot learning insights - common failure patterns, successful strategies, and lessons learned from agent fix attempts."
argument-hint: "[--type TYPE] [--tag TAG] [--recent N] - Filter by failure type, tag, or show recent N pivots."
category: "quality"
uses-skills: ["pivot-learning-skill", "error-registry-skill", "self-reporting-skill"]
related-commands: ["fix-errors", "quality-status", "skill-health"]
---

# /pivot-report Command

## Purpose

Display pivot learning insights from the error registry. Shows common failure patterns, successful pivot strategies, and lessons learned when agents changed their approach during fixing.

## Usage

```
/pivot-report [--type TYPE] [--tag TAG] [--recent N]
```

**Arguments:**
- `--type TYPE` (optional): Filter by failure type
  - `build-error` - Build/TypeScript errors
  - `lint-error` - ESLint errors
  - `test-failure` - Jest test failures
  - `runtime-error` - Runtime errors
  - `logic-error` - Logic/approach errors

- `--tag TAG` (optional): Filter by learning tag
  - `typescript`, `vue`, `eslint`, `jest`, etc.
  - `async`, `type-inference`, `mocking`, etc.

- `--recent N` (optional): Show N most recent pivots
  - Default: aggregated insights view
  - With `--recent 10`: Show last 10 individual pivots

## Examples

```
/pivot-report
# Show aggregated pivot insights

/pivot-report --type build-error
# Show only build error pivots

/pivot-report --tag typescript
# Show pivots related to TypeScript

/pivot-report --recent 20
# Show last 20 individual pivot events

/pivot-report --type lint-error --tag eslint
# Show lint error pivots with eslint tag
```

## Dashboard Output

### Aggregated Insights View (Default)

```
Pivot Learning Report
════════════════════════════════════════════════════════════════
Total Pivots: 156
Successful Pivots: 132 (84.6%)
Time Range: Last 7 days

Insights by Failure Type:
┌───────────────┬───────┬─────────┬─────────┬──────────────────────────────┐
│ Failure Type  │ Count │ Success │ Rate    │ Common Tags                  │
├───────────────┼───────┼─────────┼─────────┼──────────────────────────────┤
│ build-error   │ 45    │ 38      │ 84.4%   │ typescript, type-inference   │
│ lint-error    │ 78    │ 72      │ 92.3%   │ eslint, formatting, unused   │
│ test-failure  │ 23    │ 15      │ 65.2%   │ jest, mocking, async         │
│ runtime-error │ 8     │ 5       │ 62.5%   │ null-check, async            │
│ logic-error   │ 2     │ 2       │ 100%    │ refactoring                  │
└───────────────┴───────┴─────────┴─────────┴──────────────────────────────┘

Top Lessons Learned:
┌───┬──────────────────────────────────────────────────────────────────────┐
│ # │ Lesson                                                               │
├───┼──────────────────────────────────────────────────────────────────────┤
│ 1 │ When replacing 'any', prefer explicit union types over 'unknown'    │
│   │ when possible types are known (12 pivots)                           │
├───┼──────────────────────────────────────────────────────────────────────┤
│ 2 │ Auto-fix for indent/semi/quotes is usually safe, but verify         │
│   │ multi-line changes carefully (8 pivots)                             │
├───┼──────────────────────────────────────────────────────────────────────┤
│ 3 │ Test mocking should use vi.mock at module level, not in describe    │
│   │ blocks (7 pivots)                                                    │
├───┼──────────────────────────────────────────────────────────────────────┤
│ 4 │ ESLint @typescript-eslint/no-unused-vars - remove entire import     │
│   │ statement if all exports are unused (6 pivots)                       │
├───┼──────────────────────────────────────────────────────────────────────┤
│ 5 │ Type inference for async functions requires explicit Promise<T>     │
│   │ return type (5 pivots)                                               │
└───┴──────────────────────────────────────────────────────────────────────┘

Common Pivot Patterns:
┌──────────────────────────────────┬─────────────────────────────────────────┐
│ Approach Tried                   │ Better Approach                         │
├──────────────────────────────────┼─────────────────────────────────────────┤
│ Replace 'any' with 'unknown'     │ Use specific union types                │
│ Add type assertion               │ Fix underlying type definition          │
│ Suppress with eslint-disable     │ Actually fix the issue                  │
│ Remove unused import line        │ Remove from import statement            │
│ Mock function in test            │ Mock at module level with vi.mock       │
└──────────────────────────────────┴─────────────────────────────────────────┘

Tag Distribution:
┌────────────────┬───────┬──────────────────────────────┐
│ Tag            │ Count │ Success Rate                 │
├────────────────┼───────┼──────────────────────────────┤
│ typescript     │ 67    │ 85.1%                        │
│ eslint         │ 52    │ 92.3%                        │
│ type-inference │ 34    │ 79.4%                        │
│ jest           │ 23    │ 65.2%                        │
│ async          │ 18    │ 72.2%                        │
│ mocking        │ 15    │ 60.0%                        │
│ vue            │ 12    │ 83.3%                        │
│ unused         │ 11    │ 100%                         │
└────────────────┴───────┴──────────────────────────────┘
```

### Recent Pivots View (--recent N)

```
Recent Pivot Events
════════════════════════════════════════════════════════════════
Showing last 10 pivots

┌──────────────────────────────────────────────────────────────────────────────┐
│ #1 - 10 minutes ago                                             ✓ Worked    │
├──────────────────────────────────────────────────────────────────────────────┤
│ File: apps/api/src/services/auth.service.ts                                  │
│ Issue: TypeScript error TS2345 - Type 'unknown' not assignable               │
│ Tried: Replace any with unknown                                              │
│ Failed: Type 'unknown' is not assignable to type 'string'                    │
│ Pivoted: Use string | number union type instead                              │
│ Lesson: Prefer explicit union types over unknown when types are known        │
│ Tags: typescript, type-inference                                             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ #2 - 25 minutes ago                                             ✗ Failed    │
├──────────────────────────────────────────────────────────────────────────────┤
│ File: apps/web/src/components/Dashboard.vue                                  │
│ Issue: ESLint @typescript-eslint/no-explicit-any                             │
│ Tried: Add type assertion to suppress                                        │
│ Failed: Type assertion doesn't fix underlying issue                          │
│ Pivoted: Define proper interface for component props                         │
│ Lesson: (Pivot still in progress)                                            │
│ Tags: vue, typescript, component-props                                       │
└──────────────────────────────────────────────────────────────────────────────┘

... (8 more)
```

## Database Queries

The command queries from `code_ops` schema:

**Aggregated View:**
```sql
SELECT * FROM code_ops.pivot_insights;
```

**Recent Pivots:**
```sql
SELECT * FROM code_ops.pivot_learnings
ORDER BY created_at DESC
LIMIT N;
```

**By Type:**
```sql
SELECT * FROM code_ops.pivot_learnings
WHERE failure_type = 'build-error'
ORDER BY created_at DESC;
```

**By Tag:**
```sql
SELECT * FROM code_ops.pivot_learnings
WHERE 'typescript' = ANY(applies_to)
ORDER BY created_at DESC;
```

## Use Cases

1. **Before Fixing Session**: Review common failure patterns to avoid
2. **After Fixing Session**: See what lessons were learned
3. **Skill Improvement**: Identify areas where agents struggle
4. **Training Data**: Export pivots for improving agent prompts
5. **Code Quality Trends**: Track improvement in fix success rates

## Requirements

- Database: code_ops schema with pivot_learnings table
- Container: supabase_db_api-dev must be running
- Data: Run /fix-errors to generate pivot data

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'pivot-report', 'invoked',
  '{\"type\": \"type\", \"tag\": \"tag\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'pivot-report', 'completed', true,
  '{\"outcome\": \"Report displayed\", \"pivots_shown\": N}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'pivot-report', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Related

- **pivot-learning-skill**: Database patterns for pivots
- **file-fixer-agent**: Records pivots during fixing
- **/fix-errors**: Generates pivot data
- **/quality-status**: Overall quality metrics
- **/skill-health**: Skill performance metrics
