---
description: Manage orch-flow database operations for team files, tasks, notes, and sprints. Use for any orch-flow data operations.
argument-hint: "[operation] [type] [options]" - Examples: "create file", "list tasks", "get sprint", "create note"
category: "domain"
uses-skills: ["orch-flow-skill", "self-reporting-skill"]
uses-agents: ["orch-flow-agent"]
related-commands: []
---

# Orch Flow Command

## Purpose

Manage orch-flow database operations including team files, shared tasks, team notes, and sprints. This command ensures all orch-flow data goes to the proper PostgreSQL `orch_flow` schema tables.

## Usage

```bash
/orch-flow [operation] [type] [options]
```

### Arguments

- **`operation`**: What to do (`create`, `list`, `get`, `update`, `delete`)
- **`type`**: What to operate on (`file`, `task`, `note`, `sprint`)
- **`options`**: Additional parameters (name, content, status, etc.)

### Examples

```bash
# File operations
/orch-flow create file "README.md" --content "# Project" --path "/"
/orch-flow list files
/orch-flow get file "README.md"
/orch-flow update file "README.md" --content "Updated content"
/orch-flow delete file "README.md"

# Task operations
/orch-flow create task "Build feature X"
/orch-flow list tasks --status "in_progress"
/orch-flow update task "task-id" --status "done"
/orch-flow move task "task-id" --to "today"

# Note operations
/orch-flow create note "Meeting notes from today..."
/orch-flow list notes
/orch-flow pin note "note-id"
/orch-flow convert note "note-id" --to-file "meeting-notes.md"

# Sprint operations
/orch-flow create sprint "Sprint 1" --start "2024-01-01" --end "2024-01-14"
/orch-flow get sprint --active
/orch-flow activate sprint "sprint-id"
/orch-flow sprint-summary
```

## Workflow

### 1. Detect Context

**Required Context:**
- `team_id` - From current orch-flow session
- `user_id` - From authenticated user

**If context missing:**
- Prompt user to select team
- Get authentication context

### 2. Execute Operation

**Delegates to `orch-flow-agent` which:**
1. Loads `orch-flow-skill` for database patterns
2. Reads appropriate sub-reference (TEAM_FILES.md, SHARED_TASKS.md, etc.)
3. Executes SQL via Docker psql
4. Returns results

### 3. Report Results

**Success Example:**
```
✅ File created successfully

📄 File Details:
   Name: README.md
   Path: /
   Type: markdown
   ID: abc123-def456
```

**List Example:**
```
📁 Team Files (5 total)

/README.md (markdown)
/docs/architecture.md (markdown)
/code/utils.ts (code)
/code/helpers.ts (code)
/notes/ideas.md (markdown)
```

**Task List Example:**
```
📋 Tasks in Progress (3)

1. Build feature X (🍅 2)
2. Review PR #45 (🍅 1)
3. Fix bug in login (🍅 0)
```

## Operations Reference

### File Operations

| Operation | Description | Required |
|-----------|-------------|----------|
| `create file "name"` | Create new file | --content |
| `list files` | List all team files | (optional: --path) |
| `get file "name"` | Get file content | |
| `update file "name"` | Update file | --content |
| `delete file "name"` | Delete file | |

### Task Operations

| Operation | Description | Required |
|-----------|-------------|----------|
| `create task "title"` | Create new task | |
| `list tasks` | List tasks | (optional: --status) |
| `update task "id"` | Update task | (--status, --title) |
| `move task "id"` | Change status | --to |
| `delete task "id"` | Delete task | |
| `add-subtask "parent-id"` | Add subtask | --title |
| `increment-pomodoro "id"` | Add pomodoro | |

### Note Operations

| Operation | Description | Required |
|-----------|-------------|----------|
| `create note "content"` | Create note | |
| `list notes` | List all notes | |
| `pin note "id"` | Pin/unpin note | |
| `update note "id"` | Update content | --content |
| `delete note "id"` | Delete note | |
| `convert note "id"` | Convert to file | --to-file |

### Sprint Operations

| Operation | Description | Required |
|-----------|-------------|----------|
| `create sprint "name"` | Create sprint | --start, --end |
| `get sprint` | Get active sprint | --active |
| `list sprints` | List all sprints | |
| `activate sprint "id"` | Activate sprint | |
| `sprint-summary` | Get sprint stats | |
| `sprint-burndown` | Get burndown data | |

## Status Flow for Tasks

```
projects → this_week → today → in_progress → done
```

**Moving tasks:**
```bash
/orch-flow move task "abc123" --to "today"
/orch-flow move task "abc123" --to "in_progress"
/orch-flow move task "abc123" --to "done"
```

## File Types

| Type | Extensions | Description |
|------|------------|-------------|
| `markdown` | .md | Documentation, notes |
| `code` | .ts, .tsx, .js, .jsx, .vue, .py | Source code |
| `text` | .txt | Plain text |
| `json` | .json | JSON data |
| `yaml` | .yaml, .yml | YAML config |
| `csv` | .csv | Tabular data |

## Integration with Claude Code Panel

When the Claude Code panel in orch-flow needs to save files or data:

1. Claude Code panel calls this command
2. Command delegates to `orch-flow-agent`
3. Agent uses `orch-flow-skill` for SQL patterns
4. Data stored in `orch_flow` schema (NOT filesystem)

**Example from Claude Code panel:**
```
User: "Create a utils.ts file with helper functions"

Claude (via /orch-flow):
/orch-flow create file "utils.ts" --content "export function..." --path "/code/"
```

## Database vs Filesystem

**Use Database (`orch_flow` schema) for:**
- Team files created by users
- Files generated by Claude Code panel
- Task data
- Notes
- Sprint data

**Use Filesystem for:**
- Source code of orch-flow app itself
- Configuration files
- Build artifacts

## Related Commands

None yet - this is the primary orch-flow command.

## Related Skills and Agents

**Skills:**
- `orch-flow-skill` - Database operations and SQL patterns

**Agents:**
- `orch-flow-agent` - Autonomous database operations specialist

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'orch-flow', 'invoked',
  '{\"operation\": \"operation\", \"type\": \"type\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'orch-flow', 'completed', true,
  '{\"outcome\": \"Operation completed successfully\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'orch-flow', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Notes

- All operations require `team_id` context
- Data goes to PostgreSQL, not filesystem
- Uses Docker psql for SQL execution
- Respects row-level security policies
- Reference skill sub-files for detailed patterns
