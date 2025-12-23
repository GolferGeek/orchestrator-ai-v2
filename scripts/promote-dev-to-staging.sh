#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Promoting Dev → Staging...${NC}"

# Check if .env.dev exists
if [ ! -f .env.dev ]; then
  echo -e "${RED}❌ Error: .env.dev not found${NC}"
  echo "Create .env.dev from .env.example and configure for local development"
  exit 1
fi

# Check if .env.staging exists
if [ ! -f .env.staging ]; then
  echo -e "${YELLOW}⚠️  Warning: .env.staging not found${NC}"
  echo "Creating .env.staging from .env.dev..."
  cp .env.dev .env.staging
  echo "Please edit .env.staging and configure for staging environment"
  echo "Then run this script again"
  exit 1
fi

# 1. Stop staging (if running)
echo -e "${BLUE}⏸️  Stopping staging services...${NC}"
npm run staging:stop 2>/dev/null || echo "Staging not running, continuing..."

# 2. Export from dev
echo -e "${BLUE}📤 Exporting from dev environment...${NC}"
cp .env.dev .env
npm run db:export-snapshot || {
  echo -e "${RED}❌ Failed to export snapshot from dev${NC}"
  exit 1
}

# 3. Backup staging database (if DATABASE_URL is set)
if [ -f .env.staging ]; then
  source .env.staging
  if [ ! -z "$DATABASE_URL" ]; then
    echo -e "${BLUE}💾 Backing up staging database...${NC}"
    BACKUP_FILE="staging-backup-$(date +%Y%m%d-%H%M%S).sql"
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null || echo "Could not backup (database might be remote)"
    echo -e "${GREEN}✅ Backup saved to: $BACKUP_FILE${NC}"
  fi
fi

# 4. Apply to staging
echo -e "${BLUE}📥 Applying snapshot to staging...${NC}"
cp .env.staging .env
npm run db:apply-snapshot || {
  echo -e "${RED}❌ Failed to apply snapshot to staging${NC}"
  exit 1
}

# 5. Import agents/workflows
echo -e "${BLUE}📦 Importing agents and workflows...${NC}"
npm run db:import-all-agents || echo -e "${YELLOW}⚠️  No agents to import${NC}"
npm run db:import-all-n8n || echo -e "${YELLOW}⚠️  No N8N workflows to import${NC}"

# 6. Restart staging
echo -e "${BLUE}🚀 Restarting staging services...${NC}"
npm run staging:start || {
  echo -e "${RED}❌ Failed to start staging${NC}"
  exit 1
}

echo -e "${GREEN}✅ Promotion complete!${NC}"
echo -e "${GREEN}📍 Staging API: http://mac-studio-name:7100${NC}"
echo -e "${GREEN}📍 Staging Web: http://mac-studio-name:7101${NC}"
echo -e "${BLUE}💡 Boys can now see your changes via Tailscale${NC}"

