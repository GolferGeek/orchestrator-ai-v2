# Sprints Operations

Detailed operations for managing sprints in `orch_flow.sprints`.

## Table Structure

```sql
CREATE TABLE orch_flow.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES orch_flow.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## CRUD Operations

### Create Sprint

```sql
INSERT INTO orch_flow.sprints (
  team_id,
  name,
  start_date,
  end_date
) VALUES (
  $team_id,
  'Sprint 1 - January 2024',
  '2024-01-01',
  '2024-01-14'
)
RETURNING id, name, start_date, end_date;
```

### Activate Sprint

```sql
-- First, deactivate any current sprint
UPDATE orch_flow.sprints
SET is_active = false, updated_at = NOW()
WHERE team_id = $team_id AND is_active = true;

-- Then activate the new sprint
UPDATE orch_flow.sprints
SET is_active = true, updated_at = NOW()
WHERE team_id = $team_id AND id = $sprint_id
RETURNING id, name, is_active;
```

### Get Active Sprint

```sql
SELECT
  id, name, start_date, end_date, is_active,
  created_at, updated_at
FROM orch_flow.sprints
WHERE team_id = $team_id AND is_active = true
LIMIT 1;
```

### Get Sprint Context

**Full Sprint Context (for Claude):**
```sql
SELECT
  s.id,
  s.name,
  s.start_date,
  s.end_date,
  s.is_active,
  -- Days remaining
  GREATEST(0, s.end_date - CURRENT_DATE) as days_remaining,
  -- Progress percentage
  ROUND(
    100.0 * (CURRENT_DATE - s.start_date) /
    NULLIF(s.end_date - s.start_date, 0)
  ) as progress_percent,
  -- Task counts
  (SELECT COUNT(*) FROM orch_flow.shared_tasks t
   WHERE t.sprint_id = s.id) as total_tasks,
  (SELECT COUNT(*) FROM orch_flow.shared_tasks t
   WHERE t.sprint_id = s.id AND t.is_completed = true) as completed_tasks,
  (SELECT COUNT(*) FROM orch_flow.shared_tasks t
   WHERE t.sprint_id = s.id AND t.status = 'in_progress') as in_progress_tasks
FROM orch_flow.sprints s
WHERE s.team_id = $team_id AND s.is_active = true;
```

### List Sprints

**All Sprints:**
```sql
SELECT
  id, name, start_date, end_date, is_active,
  created_at, updated_at
FROM orch_flow.sprints
WHERE team_id = $team_id
ORDER BY start_date DESC;
```

**Active and Upcoming:**
```sql
SELECT
  id, name, start_date, end_date, is_active
FROM orch_flow.sprints
WHERE team_id = $team_id
  AND end_date >= CURRENT_DATE
ORDER BY start_date;
```

**Past Sprints:**
```sql
SELECT
  id, name, start_date, end_date
FROM orch_flow.sprints
WHERE team_id = $team_id
  AND end_date < CURRENT_DATE
  AND is_active = false
ORDER BY end_date DESC;
```

### Update Sprint

**Update Dates:**
```sql
UPDATE orch_flow.sprints
SET
  start_date = $start_date,
  end_date = $end_date,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $sprint_id
RETURNING id, name, start_date, end_date;
```

**Rename Sprint:**
```sql
UPDATE orch_flow.sprints
SET
  name = $new_name,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $sprint_id
RETURNING id, name;
```

### Delete Sprint

```sql
-- Note: This does NOT delete tasks, just unlinks them
UPDATE orch_flow.shared_tasks
SET sprint_id = NULL, updated_at = NOW()
WHERE sprint_id = $sprint_id;

-- Then delete the sprint
DELETE FROM orch_flow.sprints
WHERE team_id = $team_id AND id = $sprint_id
RETURNING id, name;
```

## Sprint Reports

### Sprint Burndown Data

```sql
WITH daily_completion AS (
  SELECT
    DATE(updated_at) as completion_date,
    COUNT(*) as tasks_completed
  FROM orch_flow.shared_tasks
  WHERE sprint_id = $sprint_id
    AND is_completed = true
  GROUP BY DATE(updated_at)
)
SELECT
  d.date,
  COALESCE(dc.tasks_completed, 0) as completed_that_day,
  SUM(COALESCE(dc.tasks_completed, 0))
    OVER (ORDER BY d.date) as cumulative_completed
FROM generate_series(
  (SELECT start_date FROM orch_flow.sprints WHERE id = $sprint_id),
  (SELECT end_date FROM orch_flow.sprints WHERE id = $sprint_id),
  '1 day'::interval
) d(date)
LEFT JOIN daily_completion dc ON dc.completion_date = d.date::date
ORDER BY d.date;
```

### Sprint Summary

```sql
SELECT
  s.name,
  s.start_date,
  s.end_date,
  COUNT(t.id) as total_tasks,
  COUNT(t.id) FILTER (WHERE t.is_completed = true) as completed,
  COUNT(t.id) FILTER (WHERE t.is_completed = false) as remaining,
  SUM(t.pomodoro_count) as total_pomodoros,
  ROUND(
    100.0 * COUNT(t.id) FILTER (WHERE t.is_completed = true) /
    NULLIF(COUNT(t.id), 0)
  ) as completion_rate
FROM orch_flow.sprints s
LEFT JOIN orch_flow.shared_tasks t ON t.sprint_id = s.id
WHERE s.team_id = $team_id AND s.id = $sprint_id
GROUP BY s.id, s.name, s.start_date, s.end_date;
```

### Team Velocity (Last N Sprints)

```sql
SELECT
  s.name,
  s.start_date,
  s.end_date,
  COUNT(t.id) FILTER (WHERE t.is_completed = true) as completed_tasks,
  SUM(t.pomodoro_count) FILTER (WHERE t.is_completed = true) as completed_pomodoros
FROM orch_flow.sprints s
LEFT JOIN orch_flow.shared_tasks t ON t.sprint_id = s.id
WHERE s.team_id = $team_id
  AND s.end_date < CURRENT_DATE
GROUP BY s.id, s.name, s.start_date, s.end_date
ORDER BY s.end_date DESC
LIMIT 5;
```

## Context for Claude

When Claude needs sprint context for suggestions:

```sql
SELECT jsonb_build_object(
  'sprint', jsonb_build_object(
    'name', s.name,
    'start_date', s.start_date,
    'end_date', s.end_date,
    'days_remaining', GREATEST(0, s.end_date - CURRENT_DATE),
    'is_active', s.is_active
  ),
  'tasks', jsonb_build_object(
    'total', COUNT(t.id),
    'completed', COUNT(t.id) FILTER (WHERE t.is_completed = true),
    'in_progress', COUNT(t.id) FILTER (WHERE t.status = 'in_progress'),
    'blocked', COUNT(t.id) FILTER (WHERE t.status = 'projects')
  ),
  'pomodoros', SUM(t.pomodoro_count)
) as sprint_context
FROM orch_flow.sprints s
LEFT JOIN orch_flow.shared_tasks t ON t.sprint_id = s.id
WHERE s.team_id = $team_id AND s.is_active = true
GROUP BY s.id;
```

## Best Practices

1. **One active sprint per team** - Deactivate old before activating new
2. **Don't delete active sprints** - Deactivate first
3. **Keep sprint history** - Don't delete past sprints for velocity tracking
4. **Link tasks to sprints** - Use sprint_id on shared_tasks
5. **Track dates carefully** - start_date and end_date are DATE, not TIMESTAMPTZ
6. **Calculate progress** - Use current date vs sprint dates
