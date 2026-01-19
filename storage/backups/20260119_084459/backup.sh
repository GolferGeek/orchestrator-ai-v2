#!/bin/bash

# Supabase Database Backup Script
# Creates a timestamped backup directory with database dump, scripts, and metadata
# This backup is portable and can be used on any machine after pulling the code

set -e

# Configuration
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_BASE_DIR="storage/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"

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

# Step 1: Create database backup
echo -e "${BLUE}📊 Step 1: Creating database dump...${NC}"
BACKUP_FILE="${BACKUP_DIR}/backup.sql"

docker exec "$DB_CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
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

set -e

# Configuration
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_FILE="backup.sql.gz"

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

# Extract and restore
echo -e "${BLUE}📦 Extracting backup...${NC}"
gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --quiet

# End time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Verify restoration
echo -e "${BLUE}✅ Verifying restoration...${NC}"
if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Database restored successfully!${NC}"
  echo -e "${GREEN}📊 Duration: ${DURATION} seconds${NC}"
else
  echo -e "${RED}❌ Error: Database restoration verification failed${NC}"
  exit 1
fi
RESTORE_SCRIPT

chmod +x "${BACKUP_DIR}/restore.sh"

# Step 4: Create metadata file
echo -e "${BLUE}📋 Step 4: Creating metadata file...${NC}"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

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
    "duration_seconds": ${DURATION}
  },
  "scripts": {
    "backup": "backup.sh",
    "restore": "restore.sh"
  }
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
echo ""
echo -e "${BLUE}🕐 Created: $(date)${NC}"
echo ""
echo -e "${BLUE}📤 Next Steps:${NC}"
echo -e "   - Backup is portable and can be used on any machine"
echo -e "   - Use /restore-db to restore from latest backup"
echo -e "   - Backup directory can be archived or transferred"
echo ""
