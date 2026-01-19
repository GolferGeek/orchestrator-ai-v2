---
description: "Restore Supabase database from the latest backup"
category: "database"
uses-skills: ["self-reporting-skill", "database-restore-skill"]
uses-agents: []
related-commands: ["backup-db"]
---

# Restore Database

Restore the Supabase database from the latest backup. Finds the most recent backup by timestamp and restores it.

**Usage:** `/restore-db`

## What This Does

1. **Finds latest backup:**
   - Scans `storage/backups/` directory
   - Identifies backup with latest timestamp
   - Validates backup files exist

2. **Restores database:**
   - Uses `psql` via Docker to restore from backup
   - Restores from `backup.sql.gz` file
   - Uses restore script from backup directory

3. **Verifies restoration:**
   - Checks database connection
   - Validates key tables exist
   - Reports restoration status

## Process

### 1. Find Latest Backup

```bash
BACKUP_BASE_DIR="storage/backups"
LATEST_BACKUP=$(ls -td "$BACKUP_BASE_DIR"/*/ 2>/dev/null | head -1)
```

### 2. Verify Backup Files

Check that backup directory contains:
- `backup.sql.gz` (or `backup.sql`)
- `restore.sh` (restore script)
- `metadata.json` (optional)

### 3. Execute Restore Script

Run the restore script from the backup directory:
```bash
cd "$LATEST_BACKUP"
bash restore.sh
```

**The restore script will:**
- Extract compressed backup if needed
- Drop existing database objects (if `--clean` flag was used)
- Restore database from SQL file
- Verify restoration success

**Full restore script and process:** See `database-restore-skill` for complete restore script content and workflow (restore script is created automatically in each backup directory).

### 4. Output Summary

```
✅ Database Restored Successfully

📦 Restored From:
   storage/backups/20260115_143022/

📊 Restoration Details:
   Backup Date: 2026-01-15 14:30:22
   Database: postgres
   Container: supabase_db_api-dev
   Duration: [X] seconds

✅ Verification:
   - Database connection: OK
   - Key tables: OK
   - Data integrity: OK

🕐 Restored: [current timestamp]
```

## Restore Script Location

The restore script is stored in each backup directory at:
`storage/backups/{timestamp}/restore.sh`

This script is created during backup and can be run independently.

## Safety Warnings

⚠️ **WARNING:** Restoring a database will:
- **Overwrite existing data** in the database
- Drop and recreate database objects
- Potentially cause data loss if backup is older than current data

**Before restoring:**
- Ensure you have a current backup
- Verify you're restoring to the correct environment
- Confirm the backup timestamp is correct

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'restore-db', 'invoked',
  '{\"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'restore-db', 'completed', true,
  '{\"backup_dir\": \"storage/backups/{timestamp}\", \"restored_at\": \"timestamp\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'restore-db', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Related

- `/backup-db` - Create a new backup
