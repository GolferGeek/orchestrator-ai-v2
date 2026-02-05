---
description: "Restore Supabase database from the latest backup"
category: "database"
uses-skills: ["self-reporting-skill", "database-restore-skill"]
uses-agents: []
related-commands: ["backup-db"]
---

# Restore Database

Restore the Supabase database from the latest backup. Finds the most recent backup by timestamp and restores it with proper FK ordering.

**Usage:** `/restore-db [backup-directory]`

**Examples:**
- `/restore-db` - Restore from latest backup
- `/restore-db storage/backups/20260205_155658/` - Restore from specific backup

## What This Does

1. **Finds latest backup:**
   - Scans `storage/backups/` directory
   - Identifies backup with latest timestamp (or uses specified directory)
   - Reads metadata to understand what was included

2. **Restores database:**
   - Restores main database structure
   - Restores auth data (users, identities)
   - Restores data in FK dependency order
   - Fixes schema permissions
   - Refreshes PostgREST schema cache

3. **Verifies restoration:**
   - Checks key tables for data
   - Reports any tables with 0 rows
   - Shows verification summary

## Restore Order (FK Dependencies)

The v2 restore script handles foreign key dependencies properly:

**Essential (always restored):**
1. prediction.universes → targets → strategies → analysts
2. prediction.signals → predictions → predictors
3. public.organizations → rbac_roles → rbac_user_org_roles
4. crawler.sources → articles → source_crawls
5. rag_data.rag_collections → rag_documents

**Org-specific (if included in backup):**
- marketing.agents, marketing.content_types
- law.*, engineering.*, leads.*

**Transient (if included in backup):**
- conversations, tasks, plans, deliverables
- checkpoints, observability_events, llm_usage

## Process

### 1. Log Invocation (Self-Reporting)

```bash
RUN_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type, details)
VALUES ('$RUN_ID', 'command', 'restore-db', '2.0', 'invoked', jsonb_build_object('triggered_by', 'user'));"
```

### 2. Execute Restore Script

Run the v2 restore script:

```bash
bash storage/scripts/restore-db-v2.sh [backup-directory]
```

### 3. Log Completion (Self-Reporting)

**On success:**
```bash
BACKUP_DIR=$(ls -td storage/backups/*/ 2>/dev/null | head -1)
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (run_id, artifact_type, artifact_name, artifact_version, event_type, success, details)
VALUES ('$RUN_ID', 'command', 'restore-db', '2.0', 'completed', true, jsonb_build_object('backup_dir', '$BACKUP_DIR'));"
```

### 4. Output Summary

```
✅ Database Restored Successfully

📦 Restored From:
   storage/backups/20260205_155658/

📊 Backup Metadata:
   transient=false, org_data=false, prod_mode=true

✅ Verification:
   auth.users: 4
   prediction.signals: 241970
   prediction.predictors: 5693
   crawler.articles: 22439

🕐 Restored: [current timestamp]

⚠️ IMPORTANT: Restart your NestJS API server to reconnect
```

## Restore Script Location

- Main script: `storage/scripts/restore-db-v2.sh`
- Each backup also contains: `restore.sh` (quick restore) and `restore-full.sh`

## Safety Warnings

⚠️ **WARNING:** Restoring a database will:
- **Overwrite existing data** in the database
- Drop and recreate database objects
- Potentially cause data loss if backup is older than current data

**Before restoring:**
- Ensure you have a current backup of any new data
- Verify you're restoring to the correct environment
- Confirm the backup timestamp is correct

## Related

- `/backup-db` - Create a new backup
- `/backup-db --prod` - Create production backup
