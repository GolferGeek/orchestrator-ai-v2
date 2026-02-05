---
description: "Create a full backup of the Supabase database with timestamped directory"
category: "database"
uses-skills: ["self-reporting-skill", "database-backup-skill"]
uses-agents: []
related-commands: ["restore-db"]
---

# Backup Database

Create a backup of the Supabase database. The backup is stored in `storage/backups/{timestamp}/` directory.

**Usage:** `/backup-db [options]`

**Options:**
- `--prod` - Production mode (essential data only, excludes transient + org data)
- `--no-transient` - Exclude transient data (conversations, tasks, checkpoints)
- `--no-org-data` - Exclude org-specific data (marketing, legal, engineering, leads)
- `--no-auth` - Exclude auth schema
- `--no-storage` - Exclude storage schema

**Examples:**
- `/backup-db` - Full backup (default)
- `/backup-db --prod` - Production backup (essential data only)
- `/backup-db --no-transient` - Exclude transient data

## Data Categories

| Category | Contents | Default | Prod Mode |
|----------|----------|---------|-----------|
| **Core** | prediction.*, crawler.*, RBAC, agents, RAG | Yes | Yes |
| **Auth** | auth.users, auth.identities | Yes | Yes |
| **Storage** | storage.* | Yes | Yes |
| **Org Data** | marketing.*, law.*, engineering.*, leads.*, company_data.*, risk.* | Yes | No |
| **Transient** | conversations, tasks, plans, deliverables, checkpoints, llm_usage | Yes | No |

## What This Does

1. **Creates timestamped backup directory:**
   - Creates `storage/backups/{YYYYMMDD_HHMMSS}/` directory

2. **Creates database backup:**
   - Uses `pg_dump` via Docker to export database
   - Exports critical tables as CSV for FK-safe restore
   - Compresses the backup with gzip

3. **Saves restore scripts:**
   - Creates `restore.sh` (quick restore)
   - Copies `restore-full.sh` (full v2 restore)

4. **Creates metadata file:**
   - Records what was included/excluded
   - Saves row counts for verification

## Process

### 1. Log Invocation (Self-Reporting)

```bash
RUN_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('$RUN_ID', 'command', 'backup-db', '2.0', 'invoked', jsonb_build_object('triggered_by', 'user'));"
```

### 2. Execute Backup Script

Run the v2 backup script with any provided options:

```bash
bash storage/scripts/backup-db-v2.sh [options]
```

### 3. Log Completion (Self-Reporting)

**On success:**
```bash
BACKUP_DIR=$(ls -td storage/backups/*/ 2>/dev/null | head -1)
BACKUP_SIZE=$(du -h "${BACKUP_DIR}backup.sql.gz" 2>/dev/null | cut -f1 || echo "unknown")
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('$RUN_ID', 'command', 'backup-db', '2.0', 'completed', true, jsonb_build_object('backup_dir', '$BACKUP_DIR', 'backup_size', '$BACKUP_SIZE'));"
```

### 4. Output Summary

```
✅ Database Backup Created Successfully

📦 Backup Location:
   storage/backups/20260205_155658/

📊 Backup Contents:
   ✅ backup.sql.gz (database dump)
   ✅ data/*.csv (critical tables)
   ✅ restore.sh (quick restore)
   ✅ restore-full.sh (full restore)
   ✅ metadata.json (backup info)
   ✅ row_counts.json (verification)

📈 Backup Details:
   Size: 39M (compressed)
   Duration: 7 seconds
   Mode: production / full

🕐 Created: 2026-02-05 15:56:58
```

## Backup Script Location

- Main script: `storage/scripts/backup-db-v2.sh`
- After backup, restore scripts are in: `storage/backups/{timestamp}/`

## Related

- `/restore-db` - Restore from latest backup
