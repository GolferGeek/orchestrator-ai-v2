# Dev Environment Fixes - December 24, 2025

This backup contains the database state after fixing several issues required to get the Marketing Swarm and login working on a fresh dev environment.

## Issues Fixed

### 1. PostgREST Marketing Schema Exposure

**Problem:** The `marketing` schema was configured in `config.toml` but PostgREST wasn't exposing it because Supabase hadn't been restarted.

**Symptom:** Error: `Invalid schema: marketing` when trying to create marketing swarm tasks.

**Fix:**
```bash
cd apps/api
npx supabase stop && npx supabase start
```

**Verification:**
```bash
docker exec supabase_rest_api-dev env | grep -i schema
# Should show: PGRST_DB_SCHEMAS=public,graphql_public,marketing
```

### 2. Marketing Schema Permissions

**Problem:** After exposing the marketing schema, PostgREST roles (`anon`, `authenticated`, `service_role`) didn't have permissions to access it.

**Symptom:** Error: `permission denied for schema marketing`

**Fix:** Run these SQL commands:
```sql
-- Grant USAGE on the marketing schema
GRANT USAGE ON SCHEMA marketing TO anon, authenticated, service_role;

-- Grant ALL privileges on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketing TO anon, authenticated, service_role;

-- Grant ALL privileges on all sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA marketing TO anon, authenticated, service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
```

**Via command line:**
```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
GRANT USAGE ON SCHEMA marketing TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketing TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA marketing TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
"
```

### 3. Outdated LLM Model IDs

**Problem:** The `llm_models` table contained old model IDs like `claude-3-haiku-20240307` which no longer exist in Anthropic's API.

**Symptom:** LLM calls fail with API errors when using old model IDs in Marketing Swarm.

**Fix:** Deactivate old models:
```sql
UPDATE public.llm_models
SET is_active = false
WHERE model_name = 'claude-3-haiku-20240307';
```

**Valid Anthropic models (as of Dec 2025):**
- `claude-3-5-haiku-20241022` (Claude 3.5 Haiku)
- `claude-haiku-4-5-20251001` (Claude Haiku 4.5)
- `claude-sonnet-4-20250514` (Claude Sonnet 4)
- `claude-sonnet-4-5-20250929` (Claude Sonnet 4.5)
- `claude-opus-4-20250514` (Claude Opus 4)
- `claude-opus-4-1-20250805` (Claude Opus 4.1)
- `claude-opus-4-5-20251101` (Claude Opus 4.5)

### 4. Duplicate Marketing Agents

**Problem:** All agents in `marketing.agents` table were duplicated.

**Symptom:** Agents appear twice in the UI selection dropdowns.

**Fix:** Remove duplicates using PostgreSQL's `ctid`:
```sql
DELETE FROM marketing.agents a
WHERE a.ctid <> (
    SELECT MIN(b.ctid)
    FROM marketing.agents b
    WHERE b.slug = a.slug
    AND b.organization_slug = a.organization_slug
);
```

### 5. Authentication Issues (From Earlier Session)

**Problem:** Duplicate refresh tokens and mismatched user IDs between `auth.users` and `public.users` tables.

**Symptoms:**
- 401 Unauthorized errors on login
- Token refresh failures

**Fixes:**
1. Clear duplicate refresh tokens:
```sql
DELETE FROM auth.refresh_tokens
WHERE id NOT IN (
    SELECT MIN(id) FROM auth.refresh_tokens GROUP BY user_id, token
);
```

2. Ensure `public.users.id` matches `auth.users.id` for each user (they must be the same UUID).

3. Check RBAC tables reference correct user IDs.

## Quick Setup Script

For a fresh environment, run these commands in order:

```bash
# 1. Start Supabase (ensures config.toml is applied)
cd apps/api
npx supabase stop && npx supabase start

# 2. Grant marketing schema permissions
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
GRANT USAGE ON SCHEMA marketing TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketing TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA marketing TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
"

# 3. Deactivate old models
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
UPDATE public.llm_models SET is_active = false WHERE model_name = 'claude-3-haiku-20240307';
"

# 4. Remove duplicate agents (if any)
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
DELETE FROM marketing.agents a
WHERE a.ctid <> (
    SELECT MIN(b.ctid)
    FROM marketing.agents b
    WHERE b.slug = a.slug
    AND b.organization_slug = a.organization_slug
);
"
```

## Restoring This Backup

To restore the database from this backup:

```bash
# Stop the API first
# Then restore:
docker exec -i supabase_db_api-dev psql -U postgres -d postgres < database-backup.sql
```

## Files in This Backup

- `database-backup.sql` - Full dump of public, marketing, and auth schemas
- `README.md` - This file

## Related Configuration

The marketing schema exposure is configured in:
- `apps/api/supabase/config.toml` line 11: `schemas = ["public", "graphql_public", "marketing"]`

Make sure this line includes `marketing` in the schemas array.
