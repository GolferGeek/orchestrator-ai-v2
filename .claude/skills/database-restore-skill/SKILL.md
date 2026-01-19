---
name: database-restore-skill
description: Restore Supabase database from backups, find latest backup, and execute restore scripts
allowed-tools: Read, Write, Bash
category: "database"
type: "utility"
used-by-agents: []
related-skills: ["database-backup-skill"]
---

# Database Restore Skill

Provides scripts and patterns for restoring Supabase database from backups.

## Finding Latest Backup

Find the most recent backup by timestamp:

```bash
BACKUP_BASE_DIR="storage/backups"
LATEST_BACKUP=$(ls -td "$BACKUP_BASE_DIR"/*/ 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ Error: No backups found in $BACKUP_BASE_DIR"
  exit 1
fi

echo "📦 Latest backup: $LATEST_BACKUP"
```

## Verifying Backup Files

Check that backup directory contains required files:

```bash
if [ ! -f "${LATEST_BACKUP}backup.sql.gz" ] && [ ! -f "${LATEST_BACKUP}backup.sql" ]; then
  echo "❌ Error: Backup SQL file not found in $LATEST_BACKUP"
  exit 1
fi

if [ ! -f "${LATEST_BACKUP}restore.sh" ]; then
  echo "❌ Error: Restore script not found in $LATEST_BACKUP"
  exit 1
fi
```

## Restore Script

The restore script is automatically created in each backup directory by the backup process. Here's the restore script template:

```bash
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
```

## Executing Restore

Execute the restore script from the backup directory:

```bash
cd "$LATEST_BACKUP"
bash restore.sh
```

## Complete Restore Process

Full restore workflow:

```bash
# 1. Find latest backup
BACKUP_BASE_DIR="storage/backups"
LATEST_BACKUP=$(ls -td "$BACKUP_BASE_DIR"/*/ 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ Error: No backups found"
  exit 1
fi

# 2. Verify backup files exist
if [ ! -f "${LATEST_BACKUP}backup.sql.gz" ]; then
  echo "❌ Error: Backup file not found"
  exit 1
fi

if [ ! -f "${LATEST_BACKUP}restore.sh" ]; then
  echo "❌ Error: Restore script not found"
  exit 1
fi

# 3. Execute restore
cd "$LATEST_BACKUP"
bash restore.sh
```

## Safety Warnings

⚠️ **WARNING:** Restoring a database will:
- **Overwrite existing data** in the database
- Drop and recreate database objects
- Potentially cause data loss if backup is older than current data

**Before restoring:**
- Ensure you have a current backup
- Verify you're restoring to the correct environment
- Confirm the backup timestamp is correct
