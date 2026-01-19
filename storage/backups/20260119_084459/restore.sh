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
