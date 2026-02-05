#!/bin/bash
# Restore script for backup - see storage/scripts/restore-db-v2.sh for full version
# This is a simplified restore that handles common issues

set -e

DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_FILE="backup.sql.gz"

echo "Starting database restore..."
echo "WARNING: This will overwrite existing data. Press Ctrl+C to cancel."
sleep 5

# Check prerequisites
if ! docker ps | grep -q "$DB_CONTAINER"; then
  echo "ERROR: Container $DB_CONTAINER not running"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found"
  exit 1
fi

# Main restore
echo "Restoring main backup..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql \
  -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 --quiet 2>&1 | \
  grep -v "^ERROR:" | grep -v "^DETAIL:" | head -10 || true

# Restore auth data
echo "Restoring auth data..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SET session_replication_role = replica;
TRUNCATE auth.identities, auth.sessions, auth.refresh_tokens, auth.users CASCADE;
SET session_replication_role = DEFAULT;
" 2>/dev/null || true

gunzip -c "$BACKUP_FILE" | sed -n '/^COPY auth\.users /,/^\\\.$/p' | \
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>/dev/null || true
gunzip -c "$BACKUP_FILE" | sed -n '/^COPY auth\.identities /,/^\\\.$/p' | \
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>/dev/null || true

# Restore critical tables in FK order
echo "Restoring critical tables in dependency order..."
TABLES=(
  "prediction.signals"
  "prediction.predictions"
  "prediction.predictors"
  "public.rbac_user_org_roles"
  "public.llm_usage"
  "public.deliverables"
)

for table in "${TABLES[@]}"; do
  count=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM ${table};" 2>/dev/null | tr -d ' ' || echo "0")
  if [ "$count" = "0" ]; then
    echo "  Restoring ${table}..."
    gunzip -c "$BACKUP_FILE" | sed -n "/^COPY ${table} /,/^\\\\.$/p" | \
      docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>/dev/null || true
  fi
done

# Fix permissions
echo "Fixing permissions..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
DO \$\$
DECLARE s TEXT;
BEGIN
  FOREACH s IN ARRAY ARRAY['public','prediction','crawler','marketing','code_ops','rag_data']
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon, authenticated, service_role', s);
    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated, service_role', s);
  END LOOP;
END \$\$;
" 2>/dev/null || true

# Refresh schema cache
echo "Refreshing schema cache..."
docker restart supabase_rest_api-dev 2>/dev/null || true

# Verify
echo ""
echo "=== Verification ==="
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 'auth.users' as tbl, count(*) FROM auth.users
UNION ALL SELECT 'prediction.signals', count(*) FROM prediction.signals
UNION ALL SELECT 'prediction.predictors', count(*) FROM prediction.predictors
UNION ALL SELECT 'public.rbac_user_org_roles', count(*) FROM public.rbac_user_org_roles
UNION ALL SELECT 'crawler.articles', count(*) FROM crawler.articles;
"

echo ""
echo "Restore complete! Restart your NestJS API server."
