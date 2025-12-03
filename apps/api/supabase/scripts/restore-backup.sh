#!/bin/bash
# Restore Database from Backup (Supabase CLI setup)
# Usage: ./restore-backup.sh [backup_file]

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
echo -e "${BLUE}🔄 Database Restore from Backup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ Error: Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

# Check if container exists and is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo -e "${RED}❌ Error: Database container '$DB_CONTAINER' is not running${NC}"
  echo "   Please start Supabase: cd apps/api && supabase start"
  exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will REPLACE your current database!${NC}"
echo -e "${YELLOW}   All existing data will be DELETED and replaced with backup data.${NC}"
echo ""
echo "   Backup file: $BACKUP_FILE"
echo "   Target database: $DB_NAME"
echo "   Container: $DB_CONTAINER"
echo ""
read -p "Continue with restore? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
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

echo -e "${BLUE}🔄 Step 2: Restoring database...${NC}"
echo "   This may take a few minutes depending on backup size..."
echo ""

# Restore the backup
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "   Decompressing and restoring..."
  gunzip -c "$BACKUP_FILE" | docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" \
    psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 2>&1 | \
    grep -v "NOTICE:" | grep -v "already exists" || true
else
  echo "   Restoring..."
  docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" \
    psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    < "$BACKUP_FILE" 2>&1 | \
    grep -v "NOTICE:" | grep -v "already exists" || true
fi

echo ""
echo -e "${GREEN}✅ Restore completed!${NC}"
echo ""

echo -e "${BLUE}🔍 Step 3: Verifying restore...${NC}"
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

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 DATABASE RESTORE COMPLETE!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Your database has been restored from the backup."
echo "   You can now verify your application is working correctly."
echo ""

