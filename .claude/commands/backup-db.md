---
description: "Create a full backup of the Supabase database with timestamped directory"
category: "database"
uses-skills: ["self-reporting-skill", "database-backup-skill"]
uses-agents: []
related-commands: ["restore-db"]
---

# Backup Database

Create a full backup of the Supabase database. The backup is stored in `storage/backups/{timestamp}/` directory and includes:
- Complete database dump (SQL file)
- Backup script itself
- Restore script
- Metadata file

**Usage:** `/backup-db`

## What This Does

1. **Creates timestamped backup directory:**
   - Creates `storage/backups/{YYYYMMDD_HHMMSS}/` directory
   - Example: `storage/backups/20260115_143022/`

2. **Creates database backup:**
   - Uses `pg_dump` via Docker to export full database
   - Creates `backup.sql` file in the backup directory
   - Compresses the backup with gzip

3. **Saves backup script:**
   - Copies the backup script to the backup directory
   - Ensures the script can be run independently after pulling code

4. **Saves restore script:**
   - Creates restore script in the backup directory
   - Script can restore this specific backup

5. **Creates metadata file:**
   - Saves backup timestamp, database info, and file sizes

## Process

### 1. Log Invocation (Self-Reporting)

```bash
RUN_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('$RUN_ID', 'command', 'backup-db', 'unknown', 'invoked', jsonb_build_object('triggered_by', 'user'));"
```

### 2. Verify Prerequisites

**Check container is running:**
```bash
docker ps --filter "name=supabase_db_api-dev" --format "{{.Names}}" | grep -q supabase_db_api-dev
```

**Verify database is accessible:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1
```

**Check available disk space:**
```bash
df -h storage/backups
```

### 3. Execute Backup Script

Run the backup script located at: `storage/scripts/backup-db.sh`

```bash
bash storage/scripts/backup-db.sh
```

**The script will:**
- Create timestamped directory in `storage/backups/`
- Run `pg_dump` to create SQL backup
- Compress the backup
- Copy backup script to backup directory
- Create restore script in backup directory
- Generate metadata file

**Full backup script:** See `database-backup-skill` for complete script content.

### 4. Log Completion (Self-Reporting)

**On success:**
```bash
BACKUP_DIR=$(ls -td storage/backups/*/ 2>/dev/null | head -1)
BACKUP_SIZE=$(du -h "${BACKUP_DIR}backup.sql.gz" 2>/dev/null | cut -f1 || echo "unknown")
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('$RUN_ID', 'command', 'backup-db', 'unknown', 'completed', true, jsonb_build_object('backup_dir', '$BACKUP_DIR', 'backup_size', '$BACKUP_SIZE'));"
```

**On failure:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('$RUN_ID', 'command', 'backup-db', 'unknown', 'completed', false, jsonb_build_object('error', 'description of what went wrong'));"
```

### 4. Output Summary

```
✅ Database Backup Created Successfully

📦 Backup Location:
   storage/backups/20260115_143022/

📊 Backup Contents:
   ✅ backup.sql.gz (database dump)
   ✅ backup.sh (backup script)
   ✅ restore.sh (restore script)
   ✅ metadata.json (backup info)

📈 Backup Details:
   Database: postgres
   Container: supabase_db_api-dev
   Size: [X] MB (compressed)
   Duration: [X] seconds

🕐 Created: 2026-01-15 14:30:22

📤 Next Steps:
   - Backup is portable and can be used on any machine
   - Use /restore-db to restore from latest backup
   - Backup directory can be archived or transferred
```

## Backup Script Location

The backup script is stored at: `storage/scripts/backup-db.sh`

After backup, a copy is saved in the backup directory at:
`storage/backups/{timestamp}/backup.sh`

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'backup-db', 'invoked',
  '{\"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'backup-db', 'completed', true,
  '{\"backup_dir\": \"storage/backups/{timestamp}\", \"backup_size\": \"X MB\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'backup-db', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Related

- `/restore-db` - Restore from latest backup
