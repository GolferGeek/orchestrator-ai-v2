# Team Notes Operations

Detailed operations for managing notes in `orch_flow.team_notes`.

## Table Structure

```sql
CREATE TABLE orch_flow.team_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES orch_flow.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content TEXT,
  is_pinned BOOLEAN DEFAULT false,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_by_guest TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## CRUD Operations

### Create Note

**Basic Note:**
```sql
INSERT INTO orch_flow.team_notes (
  team_id,
  title,
  content,
  created_by_user_id
) VALUES (
  $team_id,
  'Daily Standup Notes',
  '## Today''s Standup\n\n- Item 1\n- Item 2',
  $user_id
)
RETURNING id, title, created_at;
```

**Pinned Note:**
```sql
INSERT INTO orch_flow.team_notes (
  team_id,
  title,
  content,
  is_pinned,
  created_by_user_id
) VALUES (
  $team_id,
  'Important Announcement',
  'Please read this important update...',
  true,
  $user_id
)
RETURNING id, title, is_pinned, created_at;
```

**Guest Note:**
```sql
INSERT INTO orch_flow.team_notes (
  team_id,
  title,
  content,
  created_by_guest
) VALUES (
  $team_id,
  'Guest Feedback',
  'Notes from guest user...',
  'John (Guest)'
)
RETURNING id, title, created_at;
```

### Read Note

**Single Note:**
```sql
SELECT
  id, title, content, is_pinned,
  created_by_user_id, created_by_guest,
  created_at, updated_at
FROM orch_flow.team_notes
WHERE team_id = $team_id AND id = $note_id;
```

### Update Note

**Update Content:**
```sql
UPDATE orch_flow.team_notes
SET
  title = $title,
  content = $content,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $note_id
RETURNING id, title, updated_at;
```

**Pin Note:**
```sql
UPDATE orch_flow.team_notes
SET
  is_pinned = true,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $note_id
RETURNING id, title, is_pinned;
```

**Unpin Note:**
```sql
UPDATE orch_flow.team_notes
SET
  is_pinned = false,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $note_id
RETURNING id, title, is_pinned;
```

### Delete Note

```sql
DELETE FROM orch_flow.team_notes
WHERE team_id = $team_id AND id = $note_id
RETURNING id, title;
```

### List Notes

**All Team Notes (Pinned First):**
```sql
SELECT
  id, title, content, is_pinned,
  created_by_user_id, created_by_guest,
  created_at, updated_at
FROM orch_flow.team_notes
WHERE team_id = $team_id
ORDER BY is_pinned DESC, created_at DESC;
```

**Pinned Notes Only:**
```sql
SELECT
  id, title, content, created_at, updated_at
FROM orch_flow.team_notes
WHERE team_id = $team_id AND is_pinned = true
ORDER BY updated_at DESC;
```

**Recent Notes:**
```sql
SELECT
  id, title, is_pinned, created_at, updated_at
FROM orch_flow.team_notes
WHERE team_id = $team_id
ORDER BY updated_at DESC
LIMIT 10;
```

**Search Notes:**
```sql
SELECT
  id, title, is_pinned, created_at
FROM orch_flow.team_notes
WHERE team_id = $team_id
  AND (title ILIKE '%' || $search || '%'
       OR content ILIKE '%' || $search || '%')
ORDER BY is_pinned DESC, updated_at DESC;
```

## Common Patterns

### Get Note Count
```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_pinned = true) as pinned_count
FROM orch_flow.team_notes
WHERE team_id = $team_id;
```

### Get Recent Activity
```sql
SELECT
  id, title, updated_at,
  CASE
    WHEN updated_at > created_at THEN 'edited'
    ELSE 'created'
  END as activity
FROM orch_flow.team_notes
WHERE team_id = $team_id
  AND updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;
```

### Convert Note to File
```sql
-- Create file from note
INSERT INTO orch_flow.team_files (team_id, name, path, content, file_type, created_by_user_id)
SELECT
  team_id,
  title || '.md',
  '/notes/',
  content,
  'markdown',
  created_by_user_id
FROM orch_flow.team_notes
WHERE id = $note_id
RETURNING id, name;

-- Optionally delete original note
DELETE FROM orch_flow.team_notes WHERE id = $note_id;
```

## Best Practices

1. **Default title** - Table has default 'Untitled Note' if not provided
2. **Pin sparingly** - Too many pinned notes defeats the purpose
3. **Track authorship** - Use created_by_user_id or created_by_guest
4. **Order by pinned first** - Always show pinned notes at top
5. **Use updated_at** - Sort by most recently modified
6. **Support search** - Search both title and content
