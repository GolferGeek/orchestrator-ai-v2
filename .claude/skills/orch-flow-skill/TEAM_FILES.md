# Team Files Operations

Detailed operations for managing files in `orch_flow.team_files`.

## Table Structure

```sql
CREATE TABLE orch_flow.team_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES orch_flow.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                           -- File name with extension
  path TEXT NOT NULL DEFAULT '/',               -- Virtual folder path
  content TEXT,                                 -- Text content (markdown, code, etc.)
  file_type TEXT NOT NULL DEFAULT 'markdown',   -- Type: markdown, code, folder, image
  storage_path TEXT,                            -- For binary files in Supabase Storage
  size_bytes INTEGER DEFAULT 0,                 -- File size
  created_by_user_id UUID REFERENCES auth.users(id),
  created_by_guest TEXT,                        -- For guest users
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## File Types

| Type | Description | Content Storage |
|------|-------------|-----------------|
| `markdown` | Markdown files (.md) | `content` column |
| `code` | Source code files | `content` column |
| `folder` | Virtual folder | No content |
| `image` | Images | `storage_path` (Supabase Storage) |
| `document` | PDFs, docs | `storage_path` (Supabase Storage) |

## CRUD Operations

### Create File

**Text/Markdown File:**
```sql
INSERT INTO orch_flow.team_files (
  team_id,
  name,
  path,
  content,
  file_type,
  size_bytes,
  created_by_user_id
) VALUES (
  $team_id,
  'meeting-notes.md',
  '/notes/',
  '# Meeting Notes\n\n...',
  'markdown',
  length('# Meeting Notes\n\n...'),
  $user_id
)
RETURNING id, name, path, file_type, created_at;
```

**Folder:**
```sql
INSERT INTO orch_flow.team_files (
  team_id,
  name,
  path,
  file_type,
  created_by_user_id
) VALUES (
  $team_id,
  'Documents',
  '/',
  'folder',
  $user_id
)
RETURNING id, name, path, file_type;
```

### Read File

**Single File by ID:**
```sql
SELECT
  id, name, path, content, file_type,
  storage_path, size_bytes,
  created_by_user_id, created_by_guest,
  created_at, updated_at
FROM orch_flow.team_files
WHERE team_id = $team_id AND id = $file_id;
```

**File by Path and Name:**
```sql
SELECT
  id, name, path, content, file_type, size_bytes,
  created_at, updated_at
FROM orch_flow.team_files
WHERE team_id = $team_id
  AND path = $path
  AND name = $name;
```

### Update File

**Update Content:**
```sql
UPDATE orch_flow.team_files
SET
  content = $new_content,
  size_bytes = length($new_content),
  updated_at = NOW()
WHERE team_id = $team_id AND id = $file_id
RETURNING id, name, updated_at;
```

**Rename File:**
```sql
UPDATE orch_flow.team_files
SET
  name = $new_name,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $file_id
RETURNING id, name, path;
```

**Move File:**
```sql
UPDATE orch_flow.team_files
SET
  path = $new_path,
  updated_at = NOW()
WHERE team_id = $team_id AND id = $file_id
RETURNING id, name, path;
```

### Delete File

```sql
DELETE FROM orch_flow.team_files
WHERE team_id = $team_id AND id = $file_id
RETURNING id, name, path;
```

### List Files

**All Files in Team:**
```sql
SELECT
  id, name, path, file_type, size_bytes,
  created_at, updated_at
FROM orch_flow.team_files
WHERE team_id = $team_id
ORDER BY path, file_type DESC, name;  -- Folders first, then files
```

**Files in Folder:**
```sql
SELECT
  id, name, path, file_type, size_bytes,
  created_at, updated_at
FROM orch_flow.team_files
WHERE team_id = $team_id AND path = $folder_path
ORDER BY file_type DESC, name;  -- Folders first
```

**Search Files:**
```sql
SELECT
  id, name, path, file_type,
  created_at, updated_at
FROM orch_flow.team_files
WHERE team_id = $team_id
  AND (name ILIKE '%' || $search || '%'
       OR content ILIKE '%' || $search || '%')
ORDER BY updated_at DESC;
```

## Common Patterns

### Create File If Not Exists
```sql
INSERT INTO orch_flow.team_files (team_id, name, path, content, file_type, created_by_user_id)
VALUES ($team_id, $name, $path, $content, $file_type, $user_id)
ON CONFLICT DO NOTHING
RETURNING id, name;
```

### Get or Create Folder
```sql
INSERT INTO orch_flow.team_files (team_id, name, path, file_type, created_by_user_id)
VALUES ($team_id, $folder_name, $parent_path, 'folder', $user_id)
ON CONFLICT DO NOTHING
RETURNING id, name;
```

### Calculate Folder Size
```sql
SELECT
  SUM(size_bytes) as total_size,
  COUNT(*) as file_count
FROM orch_flow.team_files
WHERE team_id = $team_id
  AND path LIKE $folder_path || '%'
  AND file_type != 'folder';
```

## File Type Detection

When creating files, detect type from extension:

| Extension | file_type |
|-----------|-----------|
| `.md` | `markdown` |
| `.ts`, `.tsx`, `.js`, `.jsx`, `.vue` | `code` |
| `.json`, `.yaml`, `.yml` | `code` |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg` | `image` |
| `.pdf`, `.doc`, `.docx` | `document` |
| (directory) | `folder` |

## Path Conventions

- Root path: `/`
- Folders end with `/`: `/documents/`
- Files include folder path: `/documents/meeting-notes.md`
- Normalize paths: remove trailing slashes from file paths, add to folder paths

## Best Practices

1. **Always include team_id** - Never create orphaned files
2. **Track creator** - Use created_by_user_id or created_by_guest
3. **Calculate size** - Set size_bytes for text content
4. **Update timestamp** - Always update updated_at on modifications
5. **Use RETURNING** - Get confirmation of operations
6. **Handle duplicates** - Check for existing files or use ON CONFLICT
