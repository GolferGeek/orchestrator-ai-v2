#!/bin/bash
# Setup database from snapshot for new users/students
# This script handles a fresh database setup from scratch

set -e  # Exit on error

# Configuration
SNAPSHOT_DIR="${1:-apps/api/supabase/snapshots/latest}"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Orchestrator AI - Database Setup from Snapshot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check if snapshot exists
echo -e "${BLUE}📋 Step 1: Checking snapshot...${NC}"
if [ ! -d "$SNAPSHOT_DIR" ]; then
  echo -e "${RED}❌ Error: Snapshot directory not found: $SNAPSHOT_DIR${NC}"
  echo "   Expected location: apps/api/supabase/snapshots/latest/"
  exit 1
fi

if [ ! -f "$SNAPSHOT_DIR/schema.sql" ] || [ ! -f "$SNAPSHOT_DIR/seed.sql" ]; then
  echo -e "${RED}❌ Error: Snapshot files missing (schema.sql or seed.sql)${NC}"
  exit 1
fi

echo -e "${GREEN}   ✅ Snapshot found${NC}"

# Display metadata
if [ -f "$SNAPSHOT_DIR/metadata.json" ]; then
  echo ""
  echo "   Snapshot details:"
  cat "$SNAPSHOT_DIR/metadata.json" | grep -E "(timestamp|created_at|description)" | sed 's/^/   /'
fi
echo ""

# Step 2: Check Docker
echo -e "${BLUE}📋 Step 2: Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Error: Docker is not running${NC}"
  echo "   Please start Docker Desktop and try again"
  exit 1
fi
echo -e "${GREEN}   ✅ Docker is running${NC}"
echo ""

# Step 3: Check if Supabase container exists
echo -e "${BLUE}📋 Step 3: Checking Supabase...${NC}"
if ! docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo -e "${YELLOW}⚠️  Supabase container not found. Starting Supabase...${NC}"
  echo "   Running: npx supabase start"
  npx supabase start
  echo -e "${GREEN}   ✅ Supabase started${NC}"
else
  # Check if container is running
  if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo -e "${YELLOW}⚠️  Supabase container exists but is not running. Starting...${NC}"
    npx supabase start
    echo -e "${GREEN}   ✅ Supabase started${NC}"
  else
    echo -e "${GREEN}   ✅ Supabase is running${NC}"
  fi
fi
echo ""

# Step 4: Confirmation
echo -e "${YELLOW}⚠️  WARNING: This will REPLACE your current database!${NC}"
echo -e "${YELLOW}   All existing data will be deleted and replaced with snapshot data.${NC}"
echo ""
echo "   This snapshot includes:"
echo "   • All database schemas (public, auth, storage, n8n, company, observability, rag)"
echo "   • All users and authentication data"
echo "   • All RBAC roles and permissions"
echo "   • All agents and configurations"
echo "   • All conversations and tasks"
echo "   • All LLM providers and models"
echo "   • All RAG collections and documents"
echo ""
read -p "Continue with database setup? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
  echo "❌ Setup cancelled by user"
  exit 0
fi

# Step 5: Apply schema
echo ""
echo -e "${BLUE}🔧 Step 5: Applying database schema...${NC}"
docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  < "$SNAPSHOT_DIR/schema.sql"

echo -e "${GREEN}   ✅ Schema applied successfully${NC}"
echo ""

# Step 6: Apply seed data
echo -e "${BLUE}🌱 Step 6: Applying seed data...${NC}"
docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  < "$SNAPSHOT_DIR/seed.sql"

echo -e "${GREEN}   ✅ Seed data applied successfully${NC}"
echo ""

# Step 7: Verify setup
echo -e "${BLUE}🔍 Step 7: Verifying database setup...${NC}"

# Check critical tables exist
TABLES_TO_CHECK=(
  "public.organizations"
  "public.agents"
  "public.providers"
  "public.models"
  "auth.users"
  "public.rbac_roles"
  "public.rbac_permissions"
)

ALL_OK=true
for table in "${TABLES_TO_CHECK[@]}"; do
  COUNT=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
    -h localhost \
    -p 5432 \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null || echo "0")
  
  COUNT=$(echo $COUNT | xargs) # Trim whitespace
  
  if [ "$COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ $table: $COUNT rows${NC}"
  else
    echo -e "   ${YELLOW}⚠️  $table: empty or doesn't exist${NC}"
    ALL_OK=false
  fi
done
echo ""

# Success message
if [ "$ALL_OK" = true ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}🎉 DATABASE SETUP COMPLETE!${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📊 Your database is ready with:"
  echo "   ✅ All schemas created"
  echo "   ✅ All tables populated"
  echo "   ✅ Auth users configured"
  echo "   ✅ RBAC roles and permissions set"
  echo "   ✅ Agents and configurations loaded"
  echo ""
  echo "🚀 Next steps:"
  echo "   1. Copy .env.example to .env and configure your API keys"
  echo "   2. Run: npm install"
  echo "   3. Run: npm run dev"
  echo "   4. Access the app at: http://localhost:5173"
  echo ""
  echo "📚 Default credentials (if included in snapshot):"
  echo "   Email: demo.user@playground.com"
  echo "   Password: demouser"
  echo ""
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${YELLOW}⚠️  DATABASE SETUP COMPLETED WITH WARNINGS${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Some tables are empty. This may be expected if:"
  echo "  • This is a minimal snapshot"
  echo "  • Some schemas are not yet in use"
  echo ""
  echo "The database structure is ready. You can proceed with development."
  echo ""
fi








