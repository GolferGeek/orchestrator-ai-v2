#!/bin/bash
# Restore INTERN database snapshot - Complete setup for new developers
# Restores from latest snapshot or specified snapshot directory

set -e  # Exit on error

# Configuration
SNAPSHOT_DIR="${1:-apps/api/supabase/snapshots/latest}"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
DB_PORT="6012"

# Verify snapshot directory exists
if [ ! -d "$SNAPSHOT_DIR" ]; then
    echo "❌ ERROR: Snapshot directory not found: $SNAPSHOT_DIR"
    echo ""
    echo "Usage: $0 [snapshot-directory]"
    echo "   Example: $0 apps/api/supabase/snapshots/latest"
    echo "   Example: $0 apps/api/supabase/snapshots/2025-12-04-120000"
    exit 1
fi

# Verify required files exist
if [ ! -f "$SNAPSHOT_DIR/schema.sql" ]; then
    echo "❌ ERROR: schema.sql not found in $SNAPSHOT_DIR"
    exit 1
fi

if [ ! -f "$SNAPSHOT_DIR/seed.sql" ]; then
    echo "❌ ERROR: seed.sql not found in $SNAPSHOT_DIR"
    exit 1
fi

# Verify database is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "❌ ERROR: Database container '$DB_CONTAINER' is not running!"
    echo "   Start it with: cd apps/api/supabase && supabase start"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Restoring INTERN database snapshot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Snapshot: $SNAPSHOT_DIR"
echo "🗄️  Database: $DB_CONTAINER"
echo ""

# Read metadata if available
if [ -f "$SNAPSHOT_DIR/metadata.json" ]; then
    echo "📋 Snapshot Info:"
    cat "$SNAPSHOT_DIR/metadata.json" | grep -E "(timestamp|description|schemas)" | sed 's/^/   /'
    echo ""
fi

# Confirm before proceeding
read -p "⚠️  This will DROP and recreate schemas (rag_data, company_data, n8n_data, langgraph). Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 1
fi

echo ""
echo "📦 Step 1: Restoring schema structure..."
docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$SNAPSHOT_DIR/schema.sql"

if [ $? -eq 0 ]; then
    echo "   ✅ Schema restored"
else
    echo "   ❌ Schema restore failed"
    exit 1
fi

echo ""
echo "🌱 Step 2: Restoring seed data..."
docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$SNAPSHOT_DIR/seed.sql"

if [ $? -eq 0 ]; then
    echo "   ✅ Seed data restored"
else
    echo "   ❌ Seed data restore failed"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SNAPSHOT RESTORED SUCCESSFULLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo "   1. Verify database: docker exec -it $DB_CONTAINER psql -U postgres -d postgres -c '\\dt public.*'"
echo "   2. Check users: docker exec -it $DB_CONTAINER psql -U postgres -d postgres -c 'SELECT email FROM auth.users;'"
echo "   3. Check agents: docker exec -it $DB_CONTAINER psql -U postgres -d postgres -c 'SELECT slug, name FROM public.agents;'"
echo ""

