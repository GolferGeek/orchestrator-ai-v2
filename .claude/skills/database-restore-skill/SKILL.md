---
name: database-restore-skill
description: Restore Supabase database from backups, find latest backup, and execute restore scripts
allowed-tools: Read, Write, Bash
category: "database"
type: "utility"
used-by-agents: []
related-skills: ["database-backup-skill"]
---

# Database Restore Skill v2

Provides scripts and patterns for restoring Supabase database from backups with proper FK dependency ordering.

## Restore Script

The restore script is located at: `storage/scripts/restore-db-v2.sh`

## Usage

**Restore from latest backup:**
```bash
bash storage/scripts/restore-db-v2.sh
```

**Restore from specific backup:**
```bash
bash storage/scripts/restore-db-v2.sh storage/backups/20260205_155658/
```

## What the v2 Restore Does

1. **Finds backup and reads metadata:**
   - Identifies what was included (transient, org data, etc.)
   - Adjusts restore behavior based on metadata

2. **Restores main database structure:**
   - Runs pg_dump output through psql
   - Ignores expected errors from `--clean` operations

3. **Restores auth data:**
   - Truncates auth tables with `session_replication_role = replica`
   - Extracts and restores COPY statements for auth.users, auth.identities

4. **Restores data in FK dependency order:**
   - Essential tables first (prediction, crawler, RBAC)
   - Org-specific tables if included
   - Transient tables if included

5. **Fixes permissions:**
   - Grants USAGE on schemas to anon, authenticated, service_role
   - Grants table/function/sequence permissions

6. **Refreshes PostgREST schema cache:**
   - Restarts supabase_rest_api-dev container

7. **Verifies restoration:**
   - Checks key tables for data
   - Reports any issues

## FK-Ordered Restore Tables

**Essential (always restored):**

```
prediction.universes
  → prediction.targets
    → prediction.strategies
    → prediction.analysts
  → prediction.signals
    → prediction.predictions
    → prediction.predictors
  → prediction.source_subscriptions

public.organizations
  → public.rbac_roles
    → public.rbac_permissions
    → public.rbac_role_permissions
    → public.rbac_user_org_roles
  → public.llm_providers
    → public.llm_models
  → public.agents

crawler.sources
  → crawler.articles
    → crawler.source_crawls
    → crawler.agent_article_outputs

rag_data.rag_collections
  → rag_data.rag_documents
    → rag_data.rag_document_chunks
```

**Org-specific (if included in backup):**
- marketing.agents, marketing.content_types
- law.*, engineering.*, leads.*

**Transient (if included in backup):**
- public.llm_usage
- public.conversations
- public.tasks, public.plans, public.deliverables
- public.checkpoints, public.checkpoint_blobs
- public.observability_events

## Backup Metadata

The restore script reads `metadata.json` to understand what was backed up:

```json
{
  "backup": {
    "include_transient": false,
    "include_org_data": false,
    "prod_mode": true
  }
}
```

## Manual Table Restore

If automatic restore fails for a specific table, extract and restore manually:

```bash
BACKUP_FILE="storage/backups/20260205_155658/backup.sql.gz"
TABLE="prediction.signals"

gunzip -c "$BACKUP_FILE" | sed -n "/^COPY ${TABLE} /,/^\\\\.$/p" | \
  docker exec -i supabase_db_api-dev psql -U postgres -d postgres --quiet
```

## Safety Warnings

⚠️ **WARNING:** Restoring a database will:
- **Overwrite existing data** in the database
- Drop and recreate database objects
- Potentially cause data loss if backup is older than current data

**Before restoring:**
- Ensure you have a current backup of any new data
- Verify you're restoring to the correct environment
- Confirm the backup timestamp is correct

## Legacy Script

The original v1 restore script is still available at `storage/scripts/restore-db.sh` but v2 is recommended for better reliability with FK ordering.
