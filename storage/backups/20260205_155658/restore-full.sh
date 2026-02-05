#!/bin/bash

# =============================================================================
# IMPROVED Supabase Database Restore Script v2
# =============================================================================
# This script properly restores the database handling:
# 1. Foreign key dependency order
# 2. Auth data extraction (COPY only, not CREATE TABLE)
# 3. Schema cache refresh
# 4. Data verification
# =============================================================================

set -e

# Configuration
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_BASE_DIR="storage/backups"
ERROR_LOG="/tmp/restore_errors_$$.log"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Find latest backup
# Allow specifying backup directory as argument
if [ -n "$1" ] && [ -d "$1" ]; then
  LATEST_BACKUP="$1"
else
  LATEST_BACKUP=$(ls -td "$BACKUP_BASE_DIR"/*/ 2>/dev/null | head -1)
fi

if [ -z "$LATEST_BACKUP" ]; then
  echo -e "${RED}No backup directories found in $BACKUP_BASE_DIR${NC}"
  exit 1
fi

BACKUP_FILE="${LATEST_BACKUP}backup.sql.gz"
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

# Check metadata for what was included
METADATA_FILE="${LATEST_BACKUP}metadata.json"
INCLUDE_TRANSIENT="true"
INCLUDE_ORG_DATA="true"
PROD_MODE="false"

if [ -f "$METADATA_FILE" ]; then
  INCLUDE_TRANSIENT=$(cat "$METADATA_FILE" | grep -o '"include_transient": *[^,}]*' | cut -d: -f2 | tr -d ' ' || echo "true")
  INCLUDE_ORG_DATA=$(cat "$METADATA_FILE" | grep -o '"include_org_data": *[^,}]*' | cut -d: -f2 | tr -d ' ' || echo "true")
  PROD_MODE=$(cat "$METADATA_FILE" | grep -o '"prod_mode": *[^,}]*' | cut -d: -f2 | tr -d ' ' || echo "false")
  echo -e "${BLUE}Backup metadata: transient=$INCLUDE_TRANSIENT, org_data=$INCLUDE_ORG_DATA, prod_mode=$PROD_MODE${NC}"
fi

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  Supabase Database Restore v2${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}Backup: ${LATEST_BACKUP}${NC}"
echo ""

echo -e "${YELLOW}WARNING: This will overwrite existing database data!${NC}"
echo -e "${YELLOW}Press Ctrl+C within 5 seconds to cancel...${NC}"
sleep 5

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
  echo -e "${RED}Database container '$DB_CONTAINER' is not running${NC}"
  exit 1
fi

START_TIME=$(date +%s)

# =============================================================================
# STEP 1: Main restore (schemas and structure)
# =============================================================================
echo -e "${BLUE}Step 1: Restoring main database structure...${NC}"
gunzip -c "$BACKUP_FILE" 2>/dev/null | docker exec -i "$DB_CONTAINER" psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=0 \
  --quiet \
  2>&1 | tee "$ERROR_LOG" | grep -v "^ERROR:" | grep -v "^DETAIL:" | grep -v "^HINT:" | head -20 || true

echo -e "${GREEN}  Main restore complete${NC}"

# =============================================================================
# STEP 2: Restore auth data (COPY only - tables managed by Supabase)
# =============================================================================
echo -e "${BLUE}Step 2: Restoring auth data...${NC}"

# Clear existing auth data
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet -c "
SET session_replication_role = replica;
TRUNCATE auth.identities CASCADE;
TRUNCATE auth.sessions CASCADE;
TRUNCATE auth.refresh_tokens CASCADE;
TRUNCATE auth.mfa_factors CASCADE;
TRUNCATE auth.users CASCADE;
SET session_replication_role = DEFAULT;
" 2>/dev/null || true

# Restore auth.users
gunzip -c "$BACKUP_FILE" | sed -n '/^COPY auth\.users /,/^\\\.$/p' | \
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>/dev/null || true

# Restore auth.identities
gunzip -c "$BACKUP_FILE" | sed -n '/^COPY auth\.identities /,/^\\\.$/p' | \
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>/dev/null || true

AUTH_USERS=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM auth.users;" | tr -d ' ')
echo -e "${GREEN}  Auth users restored: ${AUTH_USERS}${NC}"

# =============================================================================
# STEP 3: Restore data with foreign key dependency order
# =============================================================================
echo -e "${BLUE}Step 3: Restoring data in dependency order...${NC}"

# Define restore order (parents before children)
# Essential tables - always restore
RESTORE_ORDER=(
  # Prediction schema - order matters!
  "prediction.universes"
  "prediction.targets"
  "prediction.strategies"
  "prediction.analysts"
  "prediction.signals"
  "prediction.predictions"
  "prediction.predictors"
  "prediction.source_subscriptions"

  # Public schema - essential
  "public.organizations"
  "public.users"
  "public.rbac_roles"
  "public.rbac_permissions"
  "public.rbac_role_permissions"
  "public.rbac_user_org_roles"
  "public.llm_providers"
  "public.llm_models"
  "public.agents"

  # Crawler schema - essential
  "crawler.sources"
  "crawler.articles"
  "crawler.source_crawls"
  "crawler.agent_article_outputs"

  # Core infrastructure
  "code_ops.artifacts"
  "code_ops.scan_runs"
  "code_ops.quality_issues"
  "code_ops.artifact_events"
  "rag_data.rag_collections"
  "rag_data.rag_documents"
  "rag_data.rag_document_chunks"
)

# Org-specific tables - restore only if included in backup
ORG_ORDER=(
  "marketing.agents"
  "marketing.content_types"
  # Add law, engineering, leads tables as they are created
)

# Transient tables - restore only if included in backup
TRANSIENT_ORDER=(
  "public.llm_usage"
  "public.conversations"
  "public.tasks"
  "public.plans"
  "public.deliverables"
  "public.checkpoints"
  "public.checkpoint_blobs"
  "public.observability_events"
)

# Add org-specific tables if they were included in the backup
if [ "$INCLUDE_ORG_DATA" != "false" ]; then
  RESTORE_ORDER+=("${ORG_ORDER[@]}")
fi

# Add transient tables if they were included in the backup
if [ "$INCLUDE_TRANSIENT" != "false" ]; then
  RESTORE_ORDER+=("${TRANSIENT_ORDER[@]}")
fi

for table in "${RESTORE_ORDER[@]}"; do
  # Check if table has data in backup
  has_data=$(gunzip -c "$BACKUP_FILE" | grep -c "^COPY ${table} " || echo "0")
  if [ "$has_data" -gt 0 ]; then
    # Check current row count
    current_count=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null | tr -d ' ' || echo "0")

    if [ "$current_count" = "0" ] || [ -z "$current_count" ]; then
      echo -e "  Restoring ${table}..."
      gunzip -c "$BACKUP_FILE" | sed -n "/^COPY ${table} /,/^\\\\.$/p" | \
        docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>/dev/null || true
    fi
  fi
done

echo -e "${GREEN}  Dependency-ordered restore complete${NC}"

# =============================================================================
# STEP 4: Fix permissions
# =============================================================================
echo -e "${BLUE}Step 4: Fixing schema permissions...${NC}"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet -c "
DO \$\$
DECLARE
    schema_name TEXT;
    schemas TEXT[] := ARRAY['public', 'code_ops', 'orch_flow', 'rag_data', 'risk', 'prediction', 'orchestrator_ai', 'company_data', 'engineering', 'marketing', 'n8n_data', 'crawler', 'law', 'leads'];
BEGIN
    FOREACH schema_name IN ARRAY schemas
    LOOP
        IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
            EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon, authenticated, service_role', schema_name);
            EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated, service_role', schema_name);
            EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO anon', schema_name);
            EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO anon, authenticated, service_role', schema_name);
            EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO authenticated, service_role', schema_name);
        END IF;
    END LOOP;
END \$\$;
"
echo -e "${GREEN}  Permissions fixed${NC}"

# =============================================================================
# STEP 5: Refresh PostgREST schema cache
# =============================================================================
echo -e "${BLUE}Step 5: Refreshing PostgREST schema cache...${NC}"
docker restart supabase_rest_api-dev 2>/dev/null || true
sleep 3
echo -e "${GREEN}  Schema cache refreshed${NC}"

# =============================================================================
# STEP 6: Verify restoration
# =============================================================================
echo -e "${BLUE}Step 6: Verifying restoration...${NC}"

echo ""
echo -e "${BLUE}=== DATA VERIFICATION ===${NC}"

# Key tables to verify (essential - always check)
VERIFY_TABLES=(
  "auth.users"
  "prediction.signals"
  "prediction.predictors"
  "prediction.predictions"
  "prediction.targets"
  "public.rbac_user_org_roles"
  "public.agents"
  "crawler.sources"
  "crawler.articles"
)

# Add transient tables to verification if they were included
if [ "$INCLUDE_TRANSIENT" != "false" ]; then
  VERIFY_TABLES+=("public.llm_usage")
fi

ALL_OK=true
for table in "${VERIFY_TABLES[@]}"; do
  count=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null | tr -d ' ' || echo "ERROR")
  if [ "$count" = "0" ] || [ "$count" = "ERROR" ]; then
    echo -e "  ${RED}${table}: ${count}${NC}"
    ALL_OK=false
  else
    echo -e "  ${GREEN}${table}: ${count}${NC}"
  fi
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}======================================================${NC}"
if [ "$ALL_OK" = true ]; then
  echo -e "${GREEN}  RESTORE COMPLETED SUCCESSFULLY${NC}"
else
  echo -e "${YELLOW}  RESTORE COMPLETED WITH WARNINGS${NC}"
  echo -e "${YELLOW}  Some tables may need manual restoration${NC}"
fi
echo -e "${BLUE}  Duration: ${DURATION} seconds${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT: Restart your NestJS API server to reconnect${NC}"

# Cleanup
rm -f "$ERROR_LOG"
