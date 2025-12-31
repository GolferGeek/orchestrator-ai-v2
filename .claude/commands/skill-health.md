---
description: "Display skill analytics from skill_health view - discovery rate, compliance rate, effectiveness rate, and usage patterns for all Claude Code skills."
argument-hint: "[skill-name] [--detailed] [--issues] - Show specific skill or all skills. --detailed: More metrics. --issues: Show low-performing skills."
category: "quality"
uses-skills: ["error-registry-skill", "pivot-learning-skill", "self-reporting-skill"]
uses-agents: ["claude-code-improver-agent"]
related-commands: ["pivot-report", "quality-status", "fix-claude"]
---

# /skill-health Command

## Purpose

Display skill analytics from the `skill_health` view. Shows discovery rate, compliance rate, effectiveness rate, and usage patterns for Claude Code skills. Use to identify skills that need improvement.

## Usage

```
/skill-health [skill-name] [--detailed] [--issues]
```

**Arguments:**
- `skill-name` (optional): Show health for specific skill
  - e.g., `error-registry-skill`, `api-architecture-skill`
  - (no name) - Show all skills (default)

- `--detailed` (optional): Show more detailed metrics including:
  - Usage patterns over time
  - Related pivot learnings
  - Improvement suggestions

- `--issues` (optional): Show only low-performing skills
  - Discovery rate < 30%
  - Compliance rate < 40%
  - Effectiveness rate < 50%

## Examples

```
/skill-health
# Show health dashboard for all skills

/skill-health error-registry-skill
# Show health for specific skill

/skill-health --issues
# Show only low-performing skills

/skill-health api-architecture-skill --detailed
# Detailed metrics for specific skill
```

## Dashboard Output

### All Skills View (Default)

```
Skill Health Dashboard
════════════════════════════════════════════════════════════════
Total Skills: 42
Healthy: 35 (83%)
Needs Attention: 7 (17%)
Data from last 30 days

Skill Health Summary:
┌────────────────────────────────┬───────┬────────────┬────────────┬──────────────┬────────┐
│ Skill                          │ Events│ Discovery  │ Compliance │ Effectiveness│ Status │
├────────────────────────────────┼───────┼────────────┼────────────┼──────────────┼────────┤
│ error-registry-skill           │ 156   │ 95.2%      │ 87.5%      │ 92.3%        │ ✓      │
│ api-architecture-skill         │ 89    │ 78.5%      │ 65.4%      │ 71.2%        │ ✓      │
│ execution-context-skill        │ 234   │ 98.7%      │ 92.1%      │ 95.6%        │ ✓      │
│ pivot-learning-skill           │ 45    │ 82.3%      │ 78.9%      │ 85.1%        │ ✓      │
│ web-architecture-skill         │ 67    │ 72.4%      │ 68.7%      │ 74.3%        │ ✓      │
│ langgraph-development-skill    │ 23    │ 45.2%      │ 38.5%      │ 42.1%        │ ⚠️     │
│ n8n-development-skill          │ 12    │ 28.6%      │ 31.2%      │ 35.8%        │ ❌     │
│ media-agent-skill              │ 3     │ 22.5%      │ 25.0%      │ 28.4%        │ ❌     │
└────────────────────────────────┴───────┴────────────┴────────────┴──────────────┴────────┘

Legend:
- Discovery: % of times skill was found when searched for
- Compliance: % of times patterns were followed after loading
- Effectiveness: % of times skill actually helped complete task

Status:
- ✓ Healthy: All metrics > 50%
- ⚠️ Attention: One metric below threshold
- ❌ Issues: Multiple metrics below threshold

Recommendations:
1. n8n-development-skill: Low discovery - add more keywords to description
2. media-agent-skill: Low all metrics - review and update patterns
3. langgraph-development-skill: Low compliance - add concrete examples
```

### Single Skill View (skill-name)

```
Skill Health: api-architecture-skill
════════════════════════════════════════════════════════════════
Category: architecture
Type: patterns
Last Updated: 2025-12-28

Metrics (Last 30 Days):
┌─────────────────┬───────────────────────────────────────────────┐
│ Metric          │ Value                                         │
├─────────────────┼───────────────────────────────────────────────┤
│ Total Events    │ 89                                            │
│ Discovery Rate  │ 78.5% (68/87 searches found skill)            │
│ Compliance Rate │ 65.4% (43/66 followed patterns)               │
│ Effectiveness   │ 71.2% (31/44 helped complete task)            │
│ Avg Rating      │ 3.8/5                                         │
└─────────────────┴───────────────────────────────────────────────┘

Discovery Methods:
- keyword: 45 (65%)
- mandatory: 18 (26%)
- explicit: 5 (7%)
- related: 1 (2%)

Common Search Queries:
- "api controller" (15 times)
- "nestjs service" (12 times)
- "endpoint" (8 times)
- "api patterns" (5 times)

Status: ✓ Healthy
```

### Detailed View (--detailed)

```
Skill Health: api-architecture-skill (Detailed)
════════════════════════════════════════════════════════════════

[Basic metrics as above...]

Usage Over Time:
┌──────────────┬───────┬────────────┬────────────┬──────────────┐
│ Week         │ Events│ Discovery  │ Compliance │ Effectiveness│
├──────────────┼───────┼────────────┼────────────┼──────────────┤
│ Dec 23-29    │ 34    │ 82.1%      │ 68.4%      │ 73.8%        │
│ Dec 16-22    │ 28    │ 75.2%      │ 62.1%      │ 69.5%        │
│ Dec 9-15     │ 21    │ 76.8%      │ 64.7%      │ 70.2%        │
│ Dec 2-8      │ 6     │ 78.5%      │ 65.4%      │ 71.2%        │
└──────────────┴───────┴────────────┴────────────┴──────────────┘

Trend: ↑ Improving (Discovery +6.9% over 4 weeks)

Related Pivot Learnings:
┌────┬────────────────────────────────────────────────────────────────┐
│ #  │ Lesson Learned                                                 │
├────┼────────────────────────────────────────────────────────────────┤
│ 1  │ Controllers should use DTOs for request validation (5 pivots) │
│ 2  │ Services should not import controllers (3 pivots)             │
│ 3  │ Use dependency injection for database access (2 pivots)       │
└────┴────────────────────────────────────────────────────────────────┘

Improvement Suggestions:
1. Add "DTO", "validation" keywords to improve discovery
2. Add example of correct controller-service separation
3. Document dependency injection patterns more clearly
```

### Issues View (--issues)

```
Skills Needing Attention
════════════════════════════════════════════════════════════════

Low Discovery Rate (< 30%):
┌────────────────────────────┬───────────┬───────────────────────────────┐
│ Skill                      │ Rate      │ Suggestion                    │
├────────────────────────────┼───────────┼───────────────────────────────┤
│ n8n-development-skill      │ 28.6%     │ Add more keywords             │
│ media-agent-skill          │ 22.5%     │ Review description            │
└────────────────────────────┴───────────┴───────────────────────────────┘

Low Compliance Rate (< 40%):
┌────────────────────────────┬───────────┬───────────────────────────────┐
│ Skill                      │ Rate      │ Suggestion                    │
├────────────────────────────┼───────────┼───────────────────────────────┤
│ langgraph-development-skill│ 38.5%     │ Add concrete examples         │
│ n8n-development-skill      │ 31.2%     │ Simplify patterns             │
└────────────────────────────┴───────────┴───────────────────────────────┘

Low Effectiveness Rate (< 50%):
┌────────────────────────────┬───────────┬───────────────────────────────┐
│ Skill                      │ Rate      │ Suggestion                    │
├────────────────────────────┼───────────┼───────────────────────────────┤
│ langgraph-development-skill│ 42.1%     │ Add anti-patterns             │
│ n8n-development-skill      │ 35.8%     │ Review with pivot data        │
│ media-agent-skill          │ 28.4%     │ Major revision needed         │
└────────────────────────────┴───────────┴───────────────────────────────┘

Next Steps:
- Run /fix-claude n8n-development-skill to analyze and fix
- Run /pivot-report --tag n8n to see related failures
```

## Database Queries

**Skill Health View:**
```sql
SELECT * FROM code_ops.skill_health
ORDER BY total_events DESC;
```

**Low-Performing Skills:**
```sql
SELECT * FROM code_ops.skill_health
WHERE discovery_rate_pct < 30
   OR compliance_rate_pct < 40
   OR effectiveness_rate_pct < 50
ORDER BY effectiveness_rate_pct ASC;
```

**Skill Events Detail:**
```sql
SELECT * FROM code_ops.skill_events
WHERE skill_name = 'api-architecture-skill'
ORDER BY timestamp DESC
LIMIT 100;
```

## Metric Definitions

- **Discovery Rate**: Percentage of searches that successfully found the skill
- **Compliance Rate**: Percentage of times patterns were followed after loading
- **Effectiveness Rate**: Percentage of times skill actually helped complete the task
- **Avg Rating**: Average helpfulness rating (1-5 scale)

## Thresholds

| Metric | Healthy | Attention | Issues |
|--------|---------|-----------|--------|
| Discovery | > 50% | 30-50% | < 30% |
| Compliance | > 50% | 40-50% | < 40% |
| Effectiveness | > 50% | 40-50% | < 40% |

## Requirements

- Database: code_ops schema with skill_events and skill_health view
- Container: supabase_db_api-dev must be running
- Data: Skills must be tracked via skill_events

## Related

- **pivot-learning-skill**: Provides pivot data for analysis
- **error-registry-skill**: Database query patterns
- **claude-code-improver-agent**: Uses this data to improve skills
- **/fix-claude**: Fix specific skill issues
- **/pivot-report**: View related pivot learnings

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'skill-health', 'invoked',
  '{\"skill_name\": \"skill or all\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'skill-health', 'completed', true,
  '{\"outcome\": \"Health dashboard displayed\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'skill-health', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```
