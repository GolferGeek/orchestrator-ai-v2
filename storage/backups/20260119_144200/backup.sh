#!/bin/bash

# Supabase Database Backup Script
# Creates a timestamped backup directory with database dump, scripts, and metadata
# This backup is portable and can be used on any machine after pulling the code
#
# IMPORTANT: By default, only backs up APPLICATION schemas, not Supabase-managed schemas.
# Use --include-auth and/or --include-storage to include those schemas.
#
# Usage:
#   ./backup-db.sh                    # Application schemas only (default)
#   ./backup-db.sh --include-auth     # Include auth schema
#   ./backup-db.sh --include-storage  # Include storage schema
#   ./backup-db.sh --include-auth --include-storage  # Include both

set -e

# Parse command line arguments
INCLUDE_AUTH=false
INCLUDE_STORAGE=false

for arg in "$@"; do
  case $arg in
    --include-auth)
      INCLUDE_AUTH=true
      shift
      ;;
    --include-storage)
      INCLUDE_STORAGE=true
      shift
      ;;
    *)
      # Unknown option
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

# Application schemas to backup (always included)
APP_SCHEMAS=(
  "public"
  "code_ops"
  "orch_flow"
  "rag_data"
  "risk"
  "prediction"
  "orchestrator_ai"
  "company_data"
  "engineering"
  "marketing"
  "n8n_data"
)

# Conditionally add auth and storage schemas
if [ "$INCLUDE_AUTH" = true ]; then
  APP_SCHEMAS+=("auth")
fi

if [ "$INCLUDE_STORAGE" = true ]; then
  APP_SCHEMAS+=("storage")
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Starting Supabase database backup...${NC}"
echo -e "${BLUE}📦 Backup directory: ${BACKUP_DIR}${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Start time
START_TIME=$(date +%s)

# Step 1: Create database backup (only application schemas)
echo -e "${BLUE}📊 Step 1: Creating database dump...${NC}"
echo -e "${BLUE}   Backing up schemas: ${APP_SCHEMAS[*]}${NC}"
BACKUP_FILE="${BACKUP_DIR}/backup.sql"

# Build schema arguments for pg_dump
SCHEMA_ARGS=""
for schema in "${APP_SCHEMAS[@]}"; do
  SCHEMA_ARGS="$SCHEMA_ARGS --schema=$schema"
done

docker exec "$DB_CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  $SCHEMA_ARGS \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --format=plain \
  > "$BACKUP_FILE"

# Compress the backup
echo -e "${BLUE}🗜️  Compressing backup...${NC}"
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Step 2: Copy backup script to backup directory
echo -e "${BLUE}📝 Step 2: Saving backup script...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "${SCRIPT_DIR}/backup-db.sh" "${BACKUP_DIR}/backup.sh"
chmod +x "${BACKUP_DIR}/backup.sh"

# Step 3: Create restore script in backup directory
echo -e "${BLUE}📝 Step 3: Creating restore script...${NC}"
cat > "${BACKUP_DIR}/restore.sh" << 'RESTORE_SCRIPT'
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
RESTORE_SCRIPT

chmod +x "${BACKUP_DIR}/restore.sh"

# Step 4: Create metadata file
echo -e "${BLUE}📋 Step 4: Creating metadata file...${NC}"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Convert schemas array to JSON array
SCHEMAS_JSON=$(printf '%s\n' "${APP_SCHEMAS[@]}" | jq -R . | jq -s .)

# Build notes based on what was included
NOTES="Application schemas backed up."
if [ "$INCLUDE_AUTH" = true ]; then
  NOTES="$NOTES Auth schema INCLUDED."
else
  NOTES="$NOTES Auth schema excluded (use --include-auth to include)."
fi
if [ "$INCLUDE_STORAGE" = true ]; then
  NOTES="$NOTES Storage schema INCLUDED."
else
  NOTES="$NOTES Storage schema excluded (use --include-storage to include)."
fi

cat > "${BACKUP_DIR}/metadata.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "database": {
    "name": "${DB_NAME}",
    "user": "${DB_USER}",
    "container": "${DB_CONTAINER}"
  },
  "backup": {
    "file": "backup.sql.gz",
    "size": "${BACKUP_SIZE}",
    "duration_seconds": ${DURATION},
    "schemas": ${SCHEMAS_JSON},
    "include_auth": ${INCLUDE_AUTH},
    "include_storage": ${INCLUDE_STORAGE}
  },
  "scripts": {
    "backup": "backup.sh",
    "restore": "restore.sh"
  },
  "notes": "${NOTES}"
}
EOF

# Output summary
echo ""
echo -e "${GREEN}✅ Database Backup Created Successfully!${NC}"
echo ""
echo -e "${BLUE}📦 Backup Location:${NC}"
echo -e "   ${BACKUP_DIR}/"
echo ""
echo -e "${BLUE}📊 Backup Contents:${NC}"
echo -e "   ✅ backup.sql.gz (database dump)"
echo -e "   ✅ backup.sh (backup script)"
echo -e "   ✅ restore.sh (restore script)"
echo -e "   ✅ metadata.json (backup info)"
echo ""
echo -e "${BLUE}📈 Backup Details:${NC}"
echo -e "   Database: ${DB_NAME}"
echo -e "   Container: ${DB_CONTAINER}"
echo -e "   Size: ${BACKUP_SIZE}"
echo -e "   Duration: ${DURATION} seconds"
echo -e "   Schemas: ${APP_SCHEMAS[*]}"
echo ""
if [ "$INCLUDE_AUTH" = true ] || [ "$INCLUDE_STORAGE" = true ]; then
  echo -e "${YELLOW}ℹ️  Included optional schemas:${NC}"
  [ "$INCLUDE_AUTH" = true ] && echo -e "${YELLOW}   - auth (user authentication data)${NC}"
  [ "$INCLUDE_STORAGE" = true ] && echo -e "${YELLOW}   - storage (file storage metadata)${NC}"
else
  echo -e "${YELLOW}ℹ️  Note: Supabase-managed schemas (auth, storage) are excluded by default.${NC}"
  echo -e "${YELLOW}   Use --include-auth and/or --include-storage to include them.${NC}"
fi
echo ""
echo -e "${BLUE}🕐 Created: $(date)${NC}"
echo ""
echo -e "${BLUE}📤 Next Steps:${NC}"
echo -e "   - Backup is portable and can be used on any machine"
echo -e "   - Use /restore-db to restore from latest backup"
echo -e "   - Backup directory can be archived or transferred"
echo ""
