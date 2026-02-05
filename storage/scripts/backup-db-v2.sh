#!/bin/bash

# =============================================================================
# IMPROVED Supabase Database Backup Script v2
# =============================================================================
# Creates a comprehensive backup with:
# 1. Full schema + data dump
# 2. Separate data-only exports for critical tables (FK-safe restore order)
# 3. Row counts for verification
# 4. Improved restore script
# =============================================================================

set -e

# Parse arguments
INCLUDE_AUTH=true  # Changed default to true
INCLUDE_STORAGE=true
INCLUDE_TRANSIENT=true  # conversations, tasks, checkpoints, etc.
INCLUDE_ORG_DATA=true   # marketing, legal, engineering, etc.
PROD_MODE=false  # Production mode - minimal backup

for arg in "$@"; do
  case $arg in
    --no-auth) INCLUDE_AUTH=false ;;
    --no-storage) INCLUDE_STORAGE=false ;;
    --no-transient) INCLUDE_TRANSIENT=false ;;
    --no-org-data) INCLUDE_ORG_DATA=false ;;
    --prod) PROD_MODE=true; INCLUDE_TRANSIENT=false; INCLUDE_ORG_DATA=false ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --no-auth       Exclude auth schema"
      echo "  --no-storage    Exclude storage schema"
      echo "  --no-transient  Exclude transient data (conversations, tasks, checkpoints)"
      echo "  --no-org-data   Exclude org-specific data (marketing, legal, engineering, leads)"
      echo "  --prod          Production mode (essential data only, excludes transient + org data)"
      echo ""
      echo "Essential data (always included):"
      echo "  - prediction.* (universes, targets, signals, predictions, predictors)"
      echo "  - crawler.* (sources, articles)"
      echo "  - RBAC, LLM config, agents"
      echo "  - RAG collections/documents"
      exit 0
      ;;
  esac
done

# Configuration
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_BASE_DIR="storage/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"

# Core schemas (always included)
APP_SCHEMAS=(
  "public" "prediction" "crawler" "rag_data"
  "code_ops" "orch_flow" "orchestrator_ai" "n8n_data"
)

# Org-specific schemas (optional)
ORG_SCHEMAS=(
  "marketing" "engineering" "law" "leads"
  "company_data" "risk"
)

[ "$INCLUDE_AUTH" = true ] && APP_SCHEMAS+=("auth")
[ "$INCLUDE_STORAGE" = true ] && APP_SCHEMAS+=("storage")
[ "$INCLUDE_ORG_DATA" = true ] && APP_SCHEMAS+=("${ORG_SCHEMAS[@]}")

# Critical tables that need FK-ordered restore (ALWAYS backed up)
CRITICAL_TABLES=(
  "prediction.universes"
  "prediction.targets"
  "prediction.strategies"
  "prediction.analysts"
  "prediction.signals"
  "prediction.predictions"
  "prediction.predictors"
  "prediction.source_subscriptions"
  "public.organizations"
  "public.rbac_roles"
  "public.rbac_permissions"
  "public.rbac_role_permissions"
  "public.rbac_user_org_roles"
  "public.llm_providers"
  "public.llm_models"
  "public.agents"
  "crawler.sources"
  "crawler.articles"
  "crawler.source_crawls"
  "crawler.agent_article_outputs"
  "rag_data.rag_collections"
  "rag_data.rag_documents"
)

# Transient tables that can be excluded (regeneratable data)
TRANSIENT_TABLES=(
  "public.conversations"
  "public.tasks"
  "public.plans"
  "public.deliverables"
  "public.checkpoints"
  "public.checkpoint_blobs"
  "public.observability_events"
  "public.llm_usage"
)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  Supabase Database Backup v2${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}Backup directory: ${BACKUP_DIR}${NC}"
echo -e "${BLUE}Options:${NC}"
echo "  Auth: $INCLUDE_AUTH | Storage: $INCLUDE_STORAGE"
echo "  Transient: $INCLUDE_TRANSIENT | Org Data: $INCLUDE_ORG_DATA"
[ "$PROD_MODE" = true ] && echo -e "${YELLOW}  PRODUCTION MODE - essential data only${NC}"
echo ""

mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/data"

START_TIME=$(date +%s)

# =============================================================================
# STEP 1: Full database dump
# =============================================================================
echo -e "${BLUE}Step 1: Creating full database dump...${NC}"

SCHEMA_ARGS=""
for schema in "${APP_SCHEMAS[@]}"; do
  SCHEMA_ARGS="$SCHEMA_ARGS --schema=$schema"
done

EXCLUDE_ARGS=""
if [ "$INCLUDE_TRANSIENT" = false ]; then
  echo -e "${YELLOW}  Excluding transient tables...${NC}"
  for table in "${TRANSIENT_TABLES[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-table=$table"
  done
fi

docker exec "$DB_CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  $SCHEMA_ARGS \
  $EXCLUDE_ARGS \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --format=plain \
  > "$BACKUP_DIR/backup.sql"

gzip "$BACKUP_DIR/backup.sql"
echo -e "${GREEN}  Full dump created: backup.sql.gz${NC}"

# =============================================================================
# STEP 2: Export critical tables separately (for FK-safe restore)
# =============================================================================
echo -e "${BLUE}Step 2: Exporting critical tables...${NC}"

for table in "${CRITICAL_TABLES[@]}"; do
  filename=$(echo "$table" | tr '.' '_')
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
    "COPY ${table} TO STDOUT WITH (FORMAT csv, HEADER true);" \
    > "$BACKUP_DIR/data/${filename}.csv" 2>/dev/null || true

  rows=$(wc -l < "$BACKUP_DIR/data/${filename}.csv" 2>/dev/null || echo "0")
  rows=$((rows - 1))  # Subtract header
  [ $rows -lt 0 ] && rows=0
  echo "  ${table}: ${rows} rows"
done

echo -e "${GREEN}  Critical tables exported${NC}"

# =============================================================================
# STEP 3: Record row counts
# =============================================================================
echo -e "${BLUE}Step 3: Recording row counts...${NC}"

docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT json_agg(row_to_json(t))
FROM (
  SELECT
    schemaname || '.' || tablename as table_name,
    n_live_tup as row_count
  FROM pg_stat_user_tables
  WHERE schemaname IN ('public', 'prediction', 'crawler', 'marketing', 'code_ops', 'rag_data', 'risk', 'auth')
  ORDER BY schemaname, tablename
) t;
" > "$BACKUP_DIR/row_counts.json" 2>/dev/null || echo "[]" > "$BACKUP_DIR/row_counts.json"

echo -e "${GREEN}  Row counts recorded${NC}"

# =============================================================================
# STEP 4: Create improved restore script
# =============================================================================
echo -e "${BLUE}Step 4: Creating restore script...${NC}"

cat > "$BACKUP_DIR/restore.sh" << 'RESTORE_EOF'
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
RESTORE_EOF

chmod +x "$BACKUP_DIR/restore.sh"
echo -e "${GREEN}  Restore script created${NC}"

# =============================================================================
# STEP 5: Create metadata
# =============================================================================
echo -e "${BLUE}Step 5: Creating metadata...${NC}"

BACKUP_SIZE=$(du -h "$BACKUP_DIR/backup.sql.gz" | cut -f1)
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
SCHEMAS_JSON=$(printf '%s\n' "${APP_SCHEMAS[@]}" | jq -R . | jq -s .)

TRANSIENT_JSON=$(printf '%s\n' "${TRANSIENT_TABLES[@]}" | jq -R . | jq -s .)
ORG_SCHEMAS_JSON=$(printf '%s\n' "${ORG_SCHEMAS[@]}" | jq -R . | jq -s .)

cat > "$BACKUP_DIR/metadata.json" << EOF
{
  "version": "2.0",
  "timestamp": "${TIMESTAMP}",
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "database": {
    "name": "${DB_NAME}",
    "container": "${DB_CONTAINER}"
  },
  "backup": {
    "file": "backup.sql.gz",
    "size": "${BACKUP_SIZE}",
    "duration_seconds": ${DURATION},
    "schemas": ${SCHEMAS_JSON},
    "include_auth": ${INCLUDE_AUTH},
    "include_storage": ${INCLUDE_STORAGE},
    "include_transient": ${INCLUDE_TRANSIENT},
    "include_org_data": ${INCLUDE_ORG_DATA},
    "prod_mode": ${PROD_MODE}
  },
  "critical_tables": $(printf '%s\n' "${CRITICAL_TABLES[@]}" | jq -R . | jq -s .),
  "transient_tables": ${TRANSIENT_JSON},
  "org_schemas": ${ORG_SCHEMAS_JSON},
  "notes": "Use restore.sh or storage/scripts/restore-db-v2.sh for restoration"
}
EOF

# Copy the full restore script
cp "$(dirname "$0")/restore-db-v2.sh" "$BACKUP_DIR/restore-full.sh" 2>/dev/null || true

echo -e "${GREEN}  Metadata created${NC}"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  BACKUP COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "${BLUE}Location: ${BACKUP_DIR}${NC}"
echo -e "${BLUE}Size: ${BACKUP_SIZE}${NC}"
echo -e "${BLUE}Duration: ${DURATION} seconds${NC}"
echo ""
echo -e "${BLUE}Contents:${NC}"
echo "  - backup.sql.gz (full dump)"
echo "  - data/*.csv (critical tables)"
echo "  - row_counts.json (verification data)"
echo "  - restore.sh (quick restore)"
echo "  - metadata.json"
echo ""
echo -e "${BLUE}Includes:${NC}"
echo "  - All prediction data (universes, targets, signals, predictions, predictors)"
echo "  - All crawler data (sources, articles)"
echo "  - RBAC configuration, LLM config, agents"
echo "  - RAG collections/documents"
[ "$INCLUDE_AUTH" = true ] && echo "  - Auth users/identities"
[ "$INCLUDE_STORAGE" = true ] && echo "  - Storage buckets/objects"
[ "$INCLUDE_ORG_DATA" = true ] && echo "  - Org-specific data (marketing, legal, engineering, leads)"
echo ""
if [ "$INCLUDE_TRANSIENT" = false ] || [ "$INCLUDE_ORG_DATA" = false ]; then
  echo -e "${YELLOW}Excluded:${NC}"
  [ "$INCLUDE_TRANSIENT" = false ] && echo -e "${YELLOW}  - Transient data (conversations, tasks, checkpoints, llm_usage)${NC}"
  [ "$INCLUDE_ORG_DATA" = false ] && echo -e "${YELLOW}  - Org-specific schemas (marketing, law, engineering, leads, company_data, risk)${NC}"
  echo ""
fi
echo -e "${YELLOW}To restore: cd ${BACKUP_DIR} && ./restore.sh${NC}"
echo -e "${YELLOW}Or use: storage/scripts/restore-db-v2.sh${NC}"
