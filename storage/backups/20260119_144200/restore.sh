#!/bin/bash

# Restore Script for Supabase Database Backup
# This script restores the database from the backup.sql.gz file in this directory
#
# NOTE: This backup only contains APPLICATION schemas (public, code_ops, orch_flow, etc.)
# Supabase-managed schemas (auth, storage, realtime, etc.) are NOT included.

# Don't use set -e since we want to continue past expected errors
# set -e

# Configuration
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_FILE="backup.sql.gz"
ERROR_LOG="/tmp/restore_errors_$$.log"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  WARNING: This will overwrite existing database data!${NC}"
echo -e "${YELLOW}   Press Ctrl+C within 5 seconds to cancel...${NC}"
sleep 5

echo -e "${BLUE}🔄 Starting database restoration...${NC}"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ Error: Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
  echo -e "${RED}❌ Error: Database container '$DB_CONTAINER' is not running${NC}"
  exit 1
fi

# Start time
START_TIME=$(date +%s)

# Extract and restore with ON_ERROR_ROLLBACK to continue past errors
# Capture stderr for analysis but don't fail on expected errors
echo -e "${BLUE}📦 Restoring backup...${NC}"
gunzip -c "$BACKUP_FILE" 2>/dev/null | docker exec -i "$DB_CONTAINER" psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=0 \
  --quiet \
  2>&1 | tee "$ERROR_LOG" | grep -v "^ERROR:" | grep -v "^DETAIL:" | grep -v "^HINT:" || true

# End time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Count actual errors (excluding expected "already exists" type errors)
CRITICAL_ERRORS=$(grep -c "^ERROR:" "$ERROR_LOG" 2>/dev/null || echo "0")
EXPECTED_ERRORS=$(grep -c "already exists\|does not exist\|must be owner\|cannot drop.*because other objects depend" "$ERROR_LOG" 2>/dev/null || echo "0")
REAL_ERRORS=$((CRITICAL_ERRORS - EXPECTED_ERRORS))
if [ "$REAL_ERRORS" -lt 0 ]; then REAL_ERRORS=0; fi

# Verify restoration by checking key tables
echo -e "${BLUE}✅ Verifying restoration...${NC}"
VERIFY_RESULT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
  SELECT count(*) FROM (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agents'
    UNION ALL
    SELECT 1 FROM pg_tables WHERE schemaname = 'code_ops' AND tablename = 'artifacts'
  ) t;" 2>/dev/null | tr -d ' ')

if [ "$VERIFY_RESULT" = "2" ]; then
  echo -e "${GREEN}✅ Database restored successfully!${NC}"
  echo -e "${GREEN}📊 Duration: ${DURATION} seconds${NC}"
  if [ "$CRITICAL_ERRORS" -gt 0 ]; then
    echo -e "${YELLOW}ℹ️  ${CRITICAL_ERRORS} notices (${EXPECTED_ERRORS} expected, ${REAL_ERRORS} unexpected)${NC}"
  fi
else
  echo -e "${RED}❌ Error: Database restoration verification failed${NC}"
  echo -e "${RED}   Check $ERROR_LOG for details${NC}"
  exit 1
fi

# Step 2: Fix permissions for Supabase roles
echo -e "${BLUE}🔐 Fixing schema permissions...${NC}"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet -c "
DO \$perm\$
DECLARE
    schema_name TEXT;
    schemas TEXT[] := ARRAY['public', 'code_ops', 'orch_flow', 'rag_data', 'risk', 'prediction', 'orchestrator_ai', 'company_data', 'engineering', 'marketing'];
BEGIN
    FOREACH schema_name IN ARRAY schemas
    LOOP
        IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
            EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon, authenticated, service_role', schema_name);
            EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO anon, authenticated', schema_name);
            EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role', schema_name);
            EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO anon, authenticated, service_role', schema_name);
            EXECUTE format('GRANT USAGE ON ALL SEQUENCES IN SCHEMA %I TO anon, authenticated, service_role', schema_name);
        END IF;
    END LOOP;
END \$perm\$;
"
echo -e "${GREEN}✅ Permissions fixed${NC}"

# Cleanup
rm -f "$ERROR_LOG"
