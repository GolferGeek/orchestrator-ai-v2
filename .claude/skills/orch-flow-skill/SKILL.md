---
name: orch-flow-skill
description: "Manage orch-flow database operations for team files, tasks, notes, and sprints. Use when working with orch_flow schema tables, creating/reading/updating team content, or managing SyncFocus app data. Keywords: orch-flow, team files, team notes, shared tasks, sprints, syncfocus, database operations."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "domain"
type: "database-operations"
used-by-agents: ["orch-flow-agent"]
related-skills: ["execution-context-skill", "api-architecture-skill"]
---

# Orch-Flow Skill

Manage orch-flow database operations for the SyncFocus productivity app. This skill enables Claude to work with the `orch_flow` schema for team collaboration features.

## Purpose

This skill enables agents to:
1. **Manage Team Files**: Create, read, update, delete files in `orch_flow.team_files`
2. **Manage Tasks**: Work with `orch_flow.shared_tasks` for kanban/pomodoro tasks
3. **Manage Notes**: Handle `orch_flow.team_notes` for team notes
4. **Query Sprints**: Access `orch_flow.sprints` for sprint context
5. **Understand Team Context**: Know team_id, user_id for proper scoping

## When to Use

- **File Operations**: When user wants to create, save, or manage files in orch-flow
- **Task Operations**: When user wants to create, update, or query tasks
- **Note Operations**: When user wants to create or manage team notes
- **Sprint Context**: When needing to understand current sprint
- **Database Queries**: When querying orch_flow schema tables

## Core Principles

### 1. Team Context is Required

All operations MUST have team context:
- `team_id` - Which team owns the data
- `user_id` - Who is making the request (for created_by tracking)

**Never create records without team_id** - data would be orphaned.

### 2. Use orch_flow Schema

All tables are in the `orch_flow` schema:
```sql
-- Always specify schema
SELECT * FROM orch_flow.team_files WHERE team_id = $1;
INSERT INTO orch_flow.team_notes (team_id, ...) VALUES ($1, ...);
```

### 3. RLS Policies Apply

Row-Level Security is enabled. Users can only:
- View data for teams they belong to
- Create/update/delete data for teams they belong to

## Detailed Documentation

For specific operations, see:

- **`TEAM_FILES.md`**: Team files CRUD operations
- **`SHARED_TASKS.md`**: Task management operations
- **`TEAM_NOTES.md`**: Note management operations
- **`SPRINTS.md`**: Sprint queries and context
- **`SCHEMA.md`**: Complete schema reference

## Database Schema Overview

### team_files
```sql
CREATE TABLE orch_flow.team_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES orch_flow.teams(id),
  name TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  content TEXT,                    -- For text/markdown files
  file_type TEXT NOT NULL DEFAULT 'markdown',
  storage_path TEXT,               -- For binary files in storage
  size_bytes INTEGER DEFAULT 0,
  created_by_user_id UUID,
  created_by_guest TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### shared_tasks
```sql
CREATE TABLE orch_flow.shared_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES orch_flow.teams(id),
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  assigned_to TEXT,
  user_id UUID,
  status task_status NOT NULL DEFAULT 'today',
  parent_task_id UUID,             -- For subtasks
  pomodoro_count INTEGER DEFAULT 0,
  project_id UUID,
  sprint_id UUID,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### team_notes
```sql
CREATE TABLE orch_flow.team_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES orch_flow.teams(id),
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content TEXT,
  is_pinned BOOLEAN DEFAULT false,
  created_by_user_id UUID,
  created_by_guest TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### sprints
```sql
CREATE TABLE orch_flow.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES orch_flow.teams(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## File Operations

### Create File
```sql
INSERT INTO orch_flow.team_files (team_id, name, path, content, file_type, created_by_user_id)
VALUES ($team_id, $name, $path, $content, 'markdown', $user_id)
RETURNING id, name, path, created_at;
```

### Read File
```sql
SELECT id, name, path, content, file_type, size_bytes, created_at, updated_at
FROM orch_flow.team_files
WHERE team_id = $team_id AND id = $file_id;
```

### Update File
```sql
UPDATE orch_flow.team_files
SET content = $content, updated_at = NOW()
WHERE team_id = $team_id AND id = $file_id
RETURNING id, name, updated_at;
```

### Delete File
```sql
DELETE FROM orch_flow.team_files
WHERE team_id = $team_id AND id = $file_id
RETURNING id, name;
```

### List Files
```sql
SELECT id, name, path, file_type, size_bytes, created_at, updated_at
FROM orch_flow.team_files
WHERE team_id = $team_id
ORDER BY path, name;
```

## Task Operations

### Create Task
```sql
INSERT INTO orch_flow.shared_tasks (team_id, title, status, user_id, assigned_to)
VALUES ($team_id, $title, 'today', $user_id, $display_name)
RETURNING id, title, status, created_at;
```

### Update Task Status
```sql
UPDATE orch_flow.shared_tasks
SET status = $status, updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title, status;
```

### Complete Task
```sql
UPDATE orch_flow.shared_tasks
SET is_completed = true, status = 'done', updated_at = NOW()
WHERE team_id = $team_id AND id = $task_id
RETURNING id, title;
```

### Add Subtask
```sql
INSERT INTO orch_flow.shared_tasks (team_id, title, parent_task_id, user_id, status)
VALUES ($team_id, $title, $parent_task_id, $user_id, 'today')
RETURNING id, title, parent_task_id;
```

## Note Operations

### Create Note
```sql
INSERT INTO orch_flow.team_notes (team_id, title, content, created_by_user_id)
VALUES ($team_id, $title, $content, $user_id)
RETURNING id, title, created_at;
```

### Update Note
```sql
UPDATE orch_flow.team_notes
SET title = $title, content = $content, updated_at = NOW()
WHERE team_id = $team_id AND id = $note_id
RETURNING id, title, updated_at;
```

## Sprint Operations

### Get Active Sprint
```sql
SELECT id, name, start_date, end_date
FROM orch_flow.sprints
WHERE team_id = $team_id AND is_active = true
LIMIT 1;
```

### Get Sprint Tasks
```sql
SELECT t.id, t.title, t.status, t.is_completed, t.assigned_to
FROM orch_flow.shared_tasks t
WHERE t.team_id = $team_id AND t.sprint_id = $sprint_id
ORDER BY t.status, t.created_at;
```

## Validation Checklist

When performing orch-flow operations:

- [ ] team_id is provided for all operations
- [ ] user_id is provided for created_by tracking
- [ ] Using orch_flow schema prefix
- [ ] RLS policies will allow the operation
- [ ] Correct table and column names used
- [ ] Timestamps updated where needed

## Related

- **`execution-context-skill/`**: ExecutionContext flow validation
- **`api-architecture-skill/`**: API patterns if building endpoints

## Notes

- All operations require team context
- RLS policies enforce access control
- Use RETURNING clause for confirmation
- Content is stored inline for text files
- Binary files use storage_path for Supabase Storage
