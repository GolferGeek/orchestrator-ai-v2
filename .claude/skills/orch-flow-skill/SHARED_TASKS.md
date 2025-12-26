# Shared Tasks Operations

Detailed operations for managing tasks in `orch_flow.shared_tasks`.

## Table Structure

```sql
CREATE TABLE orch_flow.shared_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES orch_flow.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  assigned_to TEXT,                              -- Display name of assignee
  user_id UUID REFERENCES auth.users(id),        -- User ID of assignee
  status task_status NOT NULL DEFAULT 'today',   -- Kanban column
  parent_task_id UUID REFERENCES orch_flow.shared_tasks(id), -- For subtasks
  pomodoro_count INTEGER DEFAULT 0,              -- Completed pomodoros
  project_id UUID,                               -- Optional project link
  sprint_id UUID REFERENCES orch_flow.sprints(id),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task status enum
CREATE TYPE orch_flow.task_status AS ENUM (
  'projects',     -- Backlog/someday
  'this_week',    -- Planned for this week
  'today',        -- Planned for today
  'in_progress',  -- Currently working
  'done'          -- Completed
);
```

## Task Status Flow

```
projects → this_week → today → in_progress → done
    ↑_____________________________________|
    (can move backwards except from done)
```

## CRUD Operations

### Create Task

**Basic Task:**
```sql
INSERT INTO orch_flow.shared_tasks (
  team_id,
  title,
  status,
  user_id,
  assigned_to
) VALUES (
  $team_id,
  'Implement login feature',
  'today',
  $user_id,
  $display_name
)
RETURNING id, title, status, created_at;
```

**Task with Due Date:**
```sql
INSERT INTO orch_flow.shared_tasks (
  team_id,
  title,
  status,
  user_id,
  assigned_to,
  due_date
) VALUES (
  $team_id,
  'Complete quarterly report',
  'this_week',
  $user_id,
  $display_name,
  '2024-01-15'::date
)
RETURNING id, title, status, due_date;
```

**Subtask:**
```sql
INSERT INTO orch_flow.shared_tasks (
  team_id,
  title,
  parent_task_id,
  user_id,
  status
) VALUES (
  $team_id,
  'Write unit tests',
  $parent_task_id,
  $user_id,
  'today'
)
RETURNING id, title, parent_task_id;
```

**Sprint Task:**
```sql
INSERT INTO orch_flow.shared_tasks (
  team_id,
  title,
  sprint_id,
  user_id,
  assigned_to,
  status
) VALUES (
  $team_id,
  'Sprint task',
  $sprint_id,
  $user_id,
  $display_name,
  'this_week'
)
RETURNING id, title, sprint_id;
```

### Read Tasks

**Single Task:**
```sql
SELECT
  id, title, is_completed, assigned_to, user_id,
  status, parent_task_id, pomodoro_count,
  project_id, sprint_id, due_date,
  created_at, updated_at
FROM orch_flow.shared_tasks
WHERE team_id = $team_id AND id = $task_id;
```

**Task with Subtasks:**
```sql
-- Get parent task
SELECT * FROM orch_flow.shared_tasks
WHERE team_id = $team_id AND id = $task_id;

-- Get subtasks
SELECT * FROM orch_flow.shared_tasks
WHERE team_id = $team_id AND parent_task_id = $task_id
ORDER BY created_at;
```

### Update Task

**Change Status:**
```sql
UPDATE orch_flow.shared_tasks
SET
  status = $new_status,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title, status;
```

**Complete Task:**
```sql
UPDATE orch_flow.shared_tasks
SET
  is_completed = true,
  status = 'done',
  updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title, is_completed;
```

**Uncomplete Task:**
```sql
UPDATE orch_flow.shared_tasks
SET
  is_completed = false,
  status = 'today',  -- Move back to today
  updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title, is_completed, status;
```

**Increment Pomodoro:**
```sql
UPDATE orch_flow.shared_tasks
SET
  pomodoro_count = pomodoro_count + 1,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title, pomodoro_count;
```

**Assign Task:**
```sql
UPDATE orch_flow.shared_tasks
SET
  user_id = $new_user_id,
  assigned_to = $new_display_name,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title, assigned_to;
```

**Unassign Task (Shared Pool):**
```sql
UPDATE orch_flow.shared_tasks
SET
  user_id = NULL,
  assigned_to = NULL,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title;
```

**Set Due Date:**
```sql
UPDATE orch_flow.shared_tasks
SET
  due_date = $due_date,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title, due_date;
```

### Delete Task

```sql
-- Deleting a parent also deletes subtasks (CASCADE)
DELETE FROM orch_flow.shared_tasks
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title;
```

### List Tasks

**All Team Tasks:**
```sql
SELECT
  id, title, is_completed, assigned_to, status,
  pomodoro_count, due_date, parent_task_id
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
ORDER BY status, created_at;
```

**Tasks by Status (Kanban Column):**
```sql
SELECT
  id, title, is_completed, assigned_to,
  pomodoro_count, due_date
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND status = $status
  AND parent_task_id IS NULL  -- Top-level tasks only
ORDER BY created_at;
```

**User's Tasks:**
```sql
SELECT
  id, title, is_completed, status,
  pomodoro_count, due_date
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND user_id = $user_id
ORDER BY status, due_date NULLS LAST;
```

**Unassigned Tasks (Shared Pool):**
```sql
SELECT
  id, title, status, pomodoro_count, due_date
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND user_id IS NULL
  AND assigned_to IS NULL
ORDER BY created_at;
```

**Overdue Tasks:**
```sql
SELECT
  id, title, assigned_to, status, due_date
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND is_completed = false
  AND due_date < NOW()
ORDER BY due_date;
```

**In Progress Tasks:**
```sql
SELECT
  id, title, assigned_to, pomodoro_count
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND status = 'in_progress'
ORDER BY updated_at DESC;
```

## Sprint Queries

**Sprint Tasks:**
```sql
SELECT
  id, title, is_completed, assigned_to, status, pomodoro_count
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND sprint_id = $sprint_id
ORDER BY status, created_at;
```

**Sprint Progress:**
```sql
SELECT
  COUNT(*) FILTER (WHERE is_completed = true) as completed_count,
  COUNT(*) FILTER (WHERE is_completed = false) as pending_count,
  COUNT(*) as total_count,
  SUM(pomodoro_count) as total_pomodoros
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND sprint_id = $sprint_id;
```

## Statistics Queries

**Team Task Summary:**
```sql
SELECT
  status,
  COUNT(*) as count,
  SUM(pomodoro_count) as pomodoros
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND parent_task_id IS NULL
GROUP BY status
ORDER BY
  CASE status
    WHEN 'projects' THEN 1
    WHEN 'this_week' THEN 2
    WHEN 'today' THEN 3
    WHEN 'in_progress' THEN 4
    WHEN 'done' THEN 5
  END;
```

**User Productivity:**
```sql
SELECT
  assigned_to,
  COUNT(*) FILTER (WHERE is_completed = true) as completed,
  COUNT(*) FILTER (WHERE is_completed = false) as pending,
  SUM(pomodoro_count) as pomodoros
FROM orch_flow.shared_tasks
WHERE team_id = $team_id
  AND assigned_to IS NOT NULL
GROUP BY assigned_to
ORDER BY completed DESC;
```

## Best Practices

1. **Use status enum values** - Always use valid status values
2. **Handle subtasks** - Check parent_task_id when listing
3. **Track pomodoros** - Increment on timer completion
4. **Set assigned_to AND user_id** - Both for display and querying
5. **Use team_id filter** - Always scope queries to team
6. **Handle NULL due_date** - Use NULLS LAST in ORDER BY
