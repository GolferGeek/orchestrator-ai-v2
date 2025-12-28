#!/bin/bash
# Export database snapshot for intern distribution (excluding n8n schema)
# Excludes n8n schema to avoid licensing issues

set -e  # Exit on error

# Configuration
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
SNAPSHOT_DIR="apps/api/supabase/snapshots/$TIMESTAMP"
LATEST_DIR="apps/api/supabase/snapshots/latest"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"

# Verify database is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "❌ ERROR: Database container '$DB_CONTAINER' is not running!"
    echo "   Start it with: cd apps/api/supabase && supabase start"
    exit 1
fi

# Create snapshot directory
mkdir -p "$SNAPSHOT_DIR"

echo "📸 Creating database snapshot (excluding n8n schema): $TIMESTAMP"
echo "   This includes ALL schemas and ALL data EXCEPT n8n"
echo ""

# Export schemas (structure only, excluding n8n)
echo "📦 Exporting schemas (excluding n8n)..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --exclude-schema=n8n \
  --schema-only \
  --no-owner \
  --no-acl \
  > "$SNAPSHOT_DIR/schema.sql"

# Add drop statements at the beginning
echo "🧹 Adding cleanup statements..."
cat > "$SNAPSHOT_DIR/schema.tmp" << EOF
-- Database Snapshot (excluding n8n schema)
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Schemas: public, auth, storage, company, observability, rag, marketing
-- Excluded: n8n (to avoid licensing issues)

-- Cleanup existing schemas (WARNING: This will delete all data!)
DROP SCHEMA IF EXISTS observability CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
DROP SCHEMA IF EXISTS rag CASCADE;
DROP SCHEMA IF EXISTS marketing CASCADE;
-- Note: public, auth, storage schemas are not dropped as they're required by PostgreSQL

-- Recreate schemas
CREATE SCHEMA IF NOT EXISTS company;
CREATE SCHEMA IF NOT EXISTS observability;
CREATE SCHEMA IF NOT EXISTS rag;
CREATE SCHEMA IF NOT EXISTS marketing;

EOF

cat "$SNAPSHOT_DIR/schema.sql" >> "$SNAPSHOT_DIR/schema.tmp"
mv "$SNAPSHOT_DIR/schema.tmp" "$SNAPSHOT_DIR/schema.sql"

echo "   ✅ Schema exported (excluding n8n)"
echo ""

# Export seed data
echo "🌱 Exporting seed data..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --table=public.agents \
  --table=public.providers \
  --table=public.models \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  > "$SNAPSHOT_DIR/seed.sql"

# Add truncate statements at the beginning
cat > "$SNAPSHOT_DIR/seed.tmp" << EOF
-- Seed Data Export (excluding n8n)
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Tables: agents, providers, models

-- Clear existing data
TRUNCATE TABLE public.agents CASCADE;
TRUNCATE TABLE public.providers CASCADE;
TRUNCATE TABLE public.models CASCADE;

EOF

cat "$SNAPSHOT_DIR/seed.sql" >> "$SNAPSHOT_DIR/seed.tmp"
mv "$SNAPSHOT_DIR/seed.tmp" "$SNAPSHOT_DIR/seed.sql"

echo "   ✅ Seed data exported"
echo ""

# Create metadata file
cat > "$SNAPSHOT_DIR/metadata.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "type": "snapshot-no-n8n",
  "description": "Database snapshot excluding n8n schema for intern setup",
  "schemas_included": ["public", "auth", "storage", "company", "observability", "rag", "marketing"],
  "schemas_excluded": ["n8n"],
  "seed_tables": ["agents", "providers", "models"],
  "db_container": "$DB_CONTAINER",
  "restore_command": "./scripts/apply-snapshot.sh snapshots/$TIMESTAMP"
}
EOF

echo "   ✅ Metadata created"
echo ""

# Update 'latest' symlink/directory
rm -rf "$LATEST_DIR"
cp -r "$SNAPSHOT_DIR" "$LATEST_DIR"

# Get snapshot size
SNAPSHOT_SIZE=$(du -sh "$SNAPSHOT_DIR" | cut -f1)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SNAPSHOT CREATED SUCCESSFULLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Snapshot location: $SNAPSHOT_DIR"
echo "🔗 Latest symlink:    $LATEST_DIR"
echo "📊 Snapshot size:     $SNAPSHOT_SIZE"
echo ""
echo "📋 Included Schemas:"
echo "   ✅ public"
echo "   ✅ auth"
echo "   ✅ storage"
echo "   ✅ company"
echo "   ✅ observability"
echo "   ✅ rag"
echo "   ✅ marketing"
echo ""
echo "🚫 Excluded Schemas:"
echo "   ❌ n8n (excluded to avoid licensing issues)"
echo ""
echo "📤 Share the 'apps/api/supabase/snapshots/latest' directory with interns"
echo ""
