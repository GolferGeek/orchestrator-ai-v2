#!/bin/bash
# Complete Setup Script - Intern Database + RAG + Migrations
# This script sets up everything needed for development

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SUPABASE_DIR/../../.." && pwd)"
SNAPSHOT_DIR="${SUPABASE_DIR}/snapshots/latest"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
DB_PORT="6012"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 Complete Development Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Check Docker
echo -e "${YELLOW}Step 1: Checking Docker...${NC}"
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo -e "${YELLOW}Please start Docker Desktop and run this script again.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Step 2: Start Supabase
echo -e "${YELLOW}Step 2: Starting Supabase...${NC}"
cd "$SUPABASE_DIR"
if supabase status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Supabase is already running${NC}"
else
    echo "Starting Supabase services..."
    supabase start
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Supabase started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start Supabase${NC}"
        exit 1
    fi
fi
echo ""

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Step 3: Restore Intern Snapshot
echo -e "${YELLOW}Step 3: Restoring intern snapshot...${NC}"
if [ ! -d "$SNAPSHOT_DIR" ]; then
    echo -e "${RED}❌ Snapshot directory not found: $SNAPSHOT_DIR${NC}"
    exit 1
fi

if [ ! -f "$SNAPSHOT_DIR/schema.sql" ] || [ ! -f "$SNAPSHOT_DIR/seed.sql" ]; then
    echo -e "${RED}❌ Snapshot files not found in $SNAPSHOT_DIR${NC}"
    exit 1
fi

# Check if database container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo -e "${RED}❌ Database container '$DB_CONTAINER' is not running!${NC}"
    exit 1
fi

echo "Restoring schema..."
docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$SNAPSHOT_DIR/schema.sql"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Schema restored${NC}"
else
    echo -e "${RED}❌ Schema restore failed${NC}"
    exit 1
fi

echo "Restoring seed data..."
docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$SNAPSHOT_DIR/seed.sql"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Seed data restored${NC}"
else
    echo -e "${RED}❌ Seed data restore failed${NC}"
    exit 1
fi
echo ""

# Step 4: Run RAG Migrations
echo -e "${YELLOW}Step 4: Running RAG migrations...${NC}"
RAG_MIGRATIONS_DIR="${SUPABASE_DIR}/migrations/migrations-rag"

if [ ! -d "$RAG_MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ RAG migrations directory not found: $RAG_MIGRATIONS_DIR${NC}"
    exit 1
fi

# Get all RAG migration files in order
RAG_MIGRATIONS=$(ls -1 "$RAG_MIGRATIONS_DIR"/*.sql | sort)

for migration in $RAG_MIGRATIONS; do
    migration_name=$(basename "$migration")
    echo "  Running: $migration_name"
    
    # RAG migrations run against the postgres database (rag_data schema)
    docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
      -h localhost \
      -p 5432 \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      < "$migration"
    
    if [ $? -eq 0 ]; then
        echo -e "    ${GREEN}✅ $migration_name${NC}"
    else
        echo -e "    ${RED}❌ $migration_name failed${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ All RAG migrations completed${NC}"
echo ""

# Step 5: Run Regular Migrations
echo -e "${YELLOW}Step 5: Running regular migrations...${NC}"
MIGRATIONS_DIR="${SUPABASE_DIR}/migrations"

# Get all migration files (excluding archive and migrations-rag)
REGULAR_MIGRATIONS=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" -type f | sort)

if [ -z "$REGULAR_MIGRATIONS" ]; then
    echo -e "${YELLOW}⚠️  No regular migrations found${NC}"
else
    for migration in $REGULAR_MIGRATIONS; do
        migration_name=$(basename "$migration")
        echo "  Running: $migration_name"
        
        docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
          -h localhost \
          -p 5432 \
          -U "$DB_USER" \
          -d "$DB_NAME" \
          < "$migration"
        
        if [ $? -eq 0 ]; then
            echo -e "    ${GREEN}✅ $migration_name${NC}"
        else
            echo -e "    ${YELLOW}⚠️  $migration_name (may already be applied)${NC}"
        fi
    done
    echo -e "${GREEN}✅ Regular migrations completed${NC}"
fi
echo ""

# Step 6: Verification
echo -e "${YELLOW}Step 6: Verifying setup...${NC}"

# Check users
USER_COUNT=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT COUNT(*) FROM auth.users;" | tr -d ' ')

echo "  Users: $USER_COUNT"

# Check agents
AGENT_COUNT=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT COUNT(*) FROM public.agents;" | tr -d ' ')

echo "  Agents: $AGENT_COUNT"

# Check RAG collections table
RAG_TABLE_EXISTS=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'rag_data' AND table_name = 'rag_collections');" | tr -d ' ')

if [ "$RAG_TABLE_EXISTS" = "t" ]; then
    echo -e "  ${GREEN}✅ RAG tables exist${NC}"
else
    echo -e "  ${RED}❌ RAG tables not found${NC}"
fi

# Check providers
PROVIDER_COUNT=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -t \
  -c "SELECT COUNT(*) FROM public.llm_providers;" | tr -d ' ')

echo "  LLM Providers: $PROVIDER_COUNT"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ SETUP COMPLETE!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📋 Next steps:"
echo "   1. Start the API: cd $PROJECT_ROOT && npm run dev:api"
echo "   2. Start the Web: cd $PROJECT_ROOT && npm run dev:web"
echo "   3. Login with one of the users from the snapshot"
echo "   4. Explore the agents in the UI"
echo ""

