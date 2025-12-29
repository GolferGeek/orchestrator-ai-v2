#!/bin/bash
# Clean Database Drop and Restore
# This script properly drops the database and restores from backup
# Usage: ./clean-restore.sh [backup_file]

set -e

# Configuration
BACKUP_FILE="${1:-apps/api/supabase/backups/full-backup-2025-12-03-065051.sql.gz}"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🗑️  Clean Database Drop and Restore${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ Error: Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

echo -e "${RED}⚠️  WARNING: This will COMPLETELY DROP your database!${NC}"
echo -e "${RED}   All existing data will be PERMANENTLY DELETED!${NC}"
echo ""
echo "   Backup file: $BACKUP_FILE"
echo "   Target database: $DB_NAME"
echo ""
read -p "Type 'DROP AND RESTORE' to continue: " confirmation

if [ "$confirmation" != "DROP AND RESTORE" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

echo ""
echo -e "${BLUE}📦 Step 1: Checking backup file...${NC}"
if [[ "$BACKUP_FILE" == *.gz ]]; then
  BACKUP_SIZE=$(gunzip -l "$BACKUP_FILE" | tail -1 | awk '{print $2}')
  echo "   ✅ Backup file: $BACKUP_FILE"
  echo "   ✅ Compressed size: $(du -h "$BACKUP_FILE" | cut -f1)"
  echo "   ✅ Uncompressed size: ~$((BACKUP_SIZE / 1024 / 1024))MB"
else
  echo "   ✅ Backup file: $BACKUP_FILE"
  echo "   ✅ Size: $(du -h "$BACKUP_FILE" | cut -f1)"
fi
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Go up from scripts/ -> supabase/ -> api/ -> apps/ -> root
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"

echo -e "${BLUE}🛑 Step 2: Stopping Supabase services...${NC}"
cd "$API_DIR" || exit 1
if command -v supabase &> /dev/null; then
  supabase stop 2>&1 | grep -v "A new version" || true
  echo "   ✅ Supabase stopped"
  sleep 2
else
  echo "   ⚠️  Supabase CLI not found, trying docker directly..."
fi
echo ""

echo -e "${BLUE}🐳 Step 3: Starting database container manually...${NC}"
# Find the docker compose file and start just the db service
cd "$API_DIR/supabase" || exit 1
if [ -f "docker-compose.yml" ]; then
  docker compose up -d db 2>&1 | grep -v "A new version" || true
  echo "   Waiting for database to be ready..."
  sleep 5
else
  echo -e "${RED}❌ Error: Could not find docker-compose.yml${NC}"
  exit 1
fi

# Wait for database to be ready
for i in {1..30}; do
  if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" > /dev/null 2>&1; then
    echo "   ✅ Database is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ Error: Database did not become ready${NC}"
    exit 1
  fi
  sleep 1
done
echo ""

echo -e "${BLUE}🔌 Step 4: Terminating all connections to postgres database...${NC}"
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" \
  psql -h localhost -p 5432 -U "$DB_USER" -d template1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid != pg_backend_pid();" \
  2>&1 | grep -v "NOTICE:" | grep -v "terminate_backend" || true
echo "   ✅ Connections terminated"
echo ""

echo -e "${BLUE}🗑️  Step 5: Dropping database...${NC}"
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" \
  psql -h localhost -p 5432 -U "$DB_USER" -d template1 \
  -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>&1 | grep -v "NOTICE:" || true
echo "   ✅ Database dropped"
echo ""

echo -e "${BLUE}🆕 Step 6: Creating fresh database...${NC}"
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" \
  psql -h localhost -p 5432 -U "$DB_USER" -d template1 \
  -c "CREATE DATABASE $DB_NAME;" 2>&1 | grep -v "NOTICE:" || true
echo "   ✅ Database created"
echo ""

echo -e "${BLUE}🔄 Step 7: Restoring from backup...${NC}"
echo "   This may take a few minutes depending on backup size..."
echo ""

# Restore the backup
RESTORE_OUTPUT=$(mktemp)
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "   Decompressing and restoring..."
  if gunzip -c "$BACKUP_FILE" | docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" \
    psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 > "$RESTORE_OUTPUT" 2>&1; then
    echo "   ✅ Restore completed successfully"
  else
    echo -e "${RED}❌ Restore failed. Checking output...${NC}"
    grep -E "(ERROR|FATAL)" "$RESTORE_OUTPUT" | head -20 || cat "$RESTORE_OUTPUT" | tail -50
    rm "$RESTORE_OUTPUT"
    exit 1
  fi
else
  echo "   Restoring..."
  if docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" \
    psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    < "$BACKUP_FILE" > "$RESTORE_OUTPUT" 2>&1; then
    echo "   ✅ Restore completed successfully"
  else
    echo -e "${RED}❌ Restore failed. Checking output...${NC}"
    grep -E "(ERROR|FATAL)" "$RESTORE_OUTPUT" | head -20 || cat "$RESTORE_OUTPUT" | tail -50
    rm "$RESTORE_OUTPUT"
    exit 1
  fi
fi
rm "$RESTORE_OUTPUT"
echo ""

echo -e "${BLUE}🔍 Step 8: Verifying restore...${NC}"
# Check a few key tables
TABLES_TO_CHECK=(
  "public.organizations"
  "public.agents"
  "public.users"
  "auth.users"
)

for table in "${TABLES_TO_CHECK[@]}"; do
  COUNT=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" \
    psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | xargs || echo "0")
  
  if [ "$COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ $table: $COUNT rows${NC}"
  else
    echo -e "   ${YELLOW}⚠️  $table: empty or doesn't exist${NC}"
  fi
done

# Verify schema
echo ""
echo -e "${BLUE}🔍 Step 9: Verifying schema...${NC}"
USERS_COLS=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" \
  psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public';" | xargs)

AGENTS_COLS=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" \
  psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'agents' AND table_schema = 'public';" | xargs)

echo "   Users table columns: $USERS_COLS"
echo "   Agents table columns: $AGENTS_COLS"

# Check for old columns
OLD_USERS_COLS=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" \
  psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public' AND column_name IN ('role', 'roles', 'namespace_access');" | xargs)

if [ "$OLD_USERS_COLS" -eq 0 ]; then
  echo -e "   ${GREEN}✅ No old columns found in users table${NC}"
else
  echo -e "   ${RED}❌ Found $OLD_USERS_COLS old columns in users table${NC}"
fi

echo ""
echo -e "${BLUE}🔄 Step 10: Restarting Supabase services...${NC}"
cd "$API_DIR" || exit 1
if command -v supabase &> /dev/null; then
  supabase start 2>&1 | grep -E "(API URL|DB URL|Started)" | head -5 || true
  echo "   ✅ Supabase restarted"
else
  echo "   ⚠️  Supabase CLI not found, please restart manually: cd apps/api && supabase start"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 CLEAN DATABASE RESTORE COMPLETE!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Your database has been completely dropped and restored from the backup."
echo "   The schema should now match the backup exactly."
echo ""

