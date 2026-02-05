---
name: database-backup-skill
description: Create portable Supabase database backups with timestamped directories, including backup script
allowed-tools: Read, Write, Bash
category: "database"
type: "utility"
used-by-agents: []
related-skills: ["database-restore-skill"]
---

# Database Backup Skill v2

Provides scripts and patterns for creating portable Supabase database backups with configurable data inclusion.

## Backup Script

The backup script is located at: `storage/scripts/backup-db-v2.sh`

## Options

```bash
./storage/scripts/backup-db-v2.sh [options]

Options:
  --no-auth       Exclude auth schema
  --no-storage    Exclude storage schema
  --no-transient  Exclude transient data (conversations, tasks, checkpoints)
  --no-org-data   Exclude org-specific data (marketing, legal, engineering, leads)
  --prod          Production mode (essential data only, excludes transient + org data)
  --help          Show usage
```

## Data Categories

| Category | Contents | Default | Prod Mode |
|----------|----------|---------|-----------|
| **Core** | prediction.*, crawler.*, RBAC, agents, RAG | Yes | Yes |
| **Auth** | auth.users, auth.identities | Yes | Yes |
| **Storage** | storage.* | Yes | Yes |
| **Org Data** | marketing.*, law.*, engineering.*, leads.*, company_data.*, risk.* | Yes | No |
| **Transient** | conversations, tasks, plans, deliverables, checkpoints, llm_usage | Yes | No |

## Usage

**Full backup (default):**
```bash
bash storage/scripts/backup-db-v2.sh
```

**Production backup (essential only):**
```bash
bash storage/scripts/backup-db-v2.sh --prod
```

**Custom exclusions:**
```bash
bash storage/scripts/backup-db-v2.sh --no-transient --no-org-data
```

## Output

The script creates in `storage/backups/{timestamp}/`:
- `backup.sql.gz` - Compressed database dump
- `data/*.csv` - Critical tables exported as CSV (for FK-safe restore)
- `row_counts.json` - Row counts for verification
- `restore.sh` - Quick restore script
- `restore-full.sh` - Full v2 restore script
- `metadata.json` - Backup metadata including what was included/excluded

## Metadata Example

```json
{
  "version": "2.0",
  "timestamp": "20260205_155658",
  "backup": {
    "include_auth": true,
    "include_storage": true,
    "include_transient": false,
    "include_org_data": false,
    "prod_mode": true
  },
  "critical_tables": ["prediction.signals", "crawler.articles", ...],
  "transient_tables": ["public.conversations", ...],
  "org_schemas": ["marketing", "law", ...]
}
```

## FK-Ordered Critical Tables

The script exports these tables separately as CSV for reliable restoration:

1. **Prediction schema:**
   - universes → targets → strategies → analysts
   - signals → predictions → predictors
   - source_subscriptions

2. **Public schema:**
   - organizations → rbac_roles → rbac_permissions → rbac_role_permissions → rbac_user_org_roles
   - llm_providers → llm_models
   - agents

3. **Crawler schema:**
   - sources → articles → source_crawls → agent_article_outputs

4. **RAG schema:**
   - rag_collections → rag_documents

## Restore Script

The restore script is automatically created in each backup directory. See `database-restore-skill` for restore operations.

## Legacy Script

The original v1 script is still available at `storage/scripts/backup-db.sh` but v2 is recommended for better reliability.
