# Database Restore Guide

## Quick Restore (For Interns)

To completely restore the database from the latest backup:

```bash
cd apps/api/supabase/scripts
./restore-database.sh
```

When prompted, type: `YES RESTORE`

That's it! The script will:
1. Stop Supabase
2. Drop the entire database
3. Restore from `latest-backup.sql.gz`
4. Restart Supabase
5. Verify all data is restored

## What Gets Restored

The restore includes **EVERYTHING**:
- ✅ All `auth.users` (Supabase authentication users)
- ✅ All `public.users` (application user profiles)
- ✅ All `public.organizations`
- ✅ All `public.agents`
- ✅ All RBAC data (`rbac_roles`, `rbac_permissions`, `rbac_user_org_roles`)
- ✅ All `orch_flow` schema data (profiles, projects, tasks, etc.)
- ✅ All `marketing` schema data (agents, content types, etc.)
- ✅ All schemas, tables, functions, triggers, and policies

## Using a Different Backup File

```bash
./restore-database.sh /path/to/your/backup.sql.gz
```

## Troubleshooting

**If restore fails:**
1. Make sure Supabase is installed: `supabase --version`
2. Make sure Docker is running: `docker ps`
3. Check the backup file exists: `ls -lh latest-backup.sql.gz`

**If you see permission errors:**
- These are normal (ALTER DEFAULT PRIVILEGES and event triggers)
- The restore still completes successfully
- Ignore these errors

## Manual Restore (If Script Fails)

If the script doesn't work, you can restore manually:

```bash
cd apps/api
supabase stop
supabase start
sleep 5

# Get container name
CONTAINER=$(docker ps --format '{{.Names}}' | grep supabase_db | head -1)

# Drop and recreate database
docker exec -e PGPASSWORD=postgres "$CONTAINER" \
  psql -h localhost -p 5432 -U postgres -d template1 \
  -c "DROP DATABASE IF EXISTS postgres; CREATE DATABASE postgres;"

# Restore backup
gunzip -c apps/api/supabase/latest-backup.sql.gz | \
  docker exec -i -e PGPASSWORD=postgres "$CONTAINER" \
  psql -h localhost -p 5432 -U postgres -d postgres

# Restart Supabase
supabase stop
supabase start
```

## Notes

- **This is a COMPLETE restore** - everything in the database is replaced
- The backup file is: `apps/api/supabase/latest-backup.sql.gz`
- Always verify the restore worked by checking the row counts at the end
- If `rbac_user_org_roles` shows 0 rows, you may need to run seed scripts

