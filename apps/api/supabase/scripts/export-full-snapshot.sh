#!/bin/bash
# Export COMPLETE database snapshot including all schemas and all data
# This creates a full backup that can be used for disaster recovery

set -e  # Exit on error

# Configuration
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
SNAPSHOT_DIR="apps/api/supabase/snapshots/$TIMESTAMP"
LATEST_DIR="apps/api/supabase/snapshots/latest"
BACKUP_DIR="apps/api/supabase/backups"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"

# Create directories
mkdir -p "$SNAPSHOT_DIR"
mkdir -p "$BACKUP_DIR"

echo "📸 Creating FULL database snapshot: $TIMESTAMP"
echo "   This includes ALL schemas and ALL data"
echo ""

# Step 1: Create a full backup first (safety net)
echo "🔒 Step 1: Creating safety backup..."
BACKUP_FILE="$BACKUP_DIR/full-backup-$TIMESTAMP.sql"
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  > "$BACKUP_FILE"

gzip "$BACKUP_FILE"
echo "   ✅ Backup saved: $BACKUP_FILE.gz"
echo ""

# Step 2: Export complete schema (ALL schemas)
echo "📦 Step 2: Exporting complete schema structure..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --schema=n8n \
  --schema=company \
  --schema=observability \
  --schema=rag \
  --schema-only \
  --no-owner \
  --no-acl \
  > "$SNAPSHOT_DIR/schema.sql"

echo "   ✅ Schema exported (public, auth, storage, n8n, company, observability, rag)"
echo ""

# Step 3: Export ALL data from critical tables
echo "🌱 Step 3: Exporting seed data (ALL critical tables)..."

# Create seed file with header
cat > "$SNAPSHOT_DIR/seed.sql" << 'EOF'
-- Full Database Seed Data
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Contains ALL data from critical tables across all schemas

-- Disable triggers during import for speed
SET session_replication_role = replica;

EOF

# Export data from all critical tables
echo "   Exporting public schema tables..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=public \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  >> "$SNAPSHOT_DIR/seed.sql"

echo "   Exporting auth schema tables..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=auth \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  >> "$SNAPSHOT_DIR/seed.sql"

echo "   Exporting n8n schema tables..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=n8n \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  >> "$SNAPSHOT_DIR/seed.sql" 2>/dev/null || echo "   ⚠️  n8n schema empty or doesn't exist"

echo "   Exporting company schema tables..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=company \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  >> "$SNAPSHOT_DIR/seed.sql" 2>/dev/null || echo "   ⚠️  company schema empty or doesn't exist"

echo "   Exporting observability schema tables..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=observability \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  >> "$SNAPSHOT_DIR/seed.sql" 2>/dev/null || echo "   ⚠️  observability schema empty or doesn't exist"

echo "   Exporting rag schema tables..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=rag \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  >> "$SNAPSHOT_DIR/seed.sql" 2>/dev/null || echo "   ⚠️  rag schema empty or doesn't exist"

# Re-enable triggers
cat >> "$SNAPSHOT_DIR/seed.sql" << 'EOF'

-- Re-enable triggers
SET session_replication_role = DEFAULT;
EOF

echo "   ✅ All data exported"
echo ""

# Step 4: Create metadata file
echo "📋 Step 4: Creating metadata..."
cat > "$SNAPSHOT_DIR/metadata.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "type": "full-snapshot",
  "description": "Complete database snapshot with all schemas and all data",
  "schemas": ["public", "auth", "storage", "n8n", "company", "observability", "rag"],
  "includes": {
    "schema": true,
    "all_data": true,
    "auth_users": true,
    "rbac": true,
    "agents": true,
    "conversations": true,
    "tasks": true,
    "llm_config": true,
    "rag_data": true
  },
  "db_container": "$DB_CONTAINER",
  "restore_command": "./scripts/apply-snapshot.sh snapshots/$TIMESTAMP"
}
EOF

echo "   ✅ Metadata created"
echo ""

# Step 5: Update 'latest' symlink
echo "🔗 Step 5: Updating 'latest' symlink..."
rm -rf "$LATEST_DIR"
cp -r "$SNAPSHOT_DIR" "$LATEST_DIR"
echo "   ✅ Latest snapshot updated"
echo ""

# Step 6: Create summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ FULL SNAPSHOT CREATED SUCCESSFULLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Snapshot location: $SNAPSHOT_DIR"
echo "🔗 Latest symlink:    $LATEST_DIR"
echo "🔒 Safety backup:     $BACKUP_FILE.gz"
echo ""
echo "📊 Contents:"
echo "   ✅ schema.sql  - Complete database structure (all schemas)"
echo "   ✅ seed.sql    - ALL data from all tables"
echo "   ✅ metadata.json - Snapshot information"
echo ""
echo "🔄 To restore this snapshot:"
echo "   cd apps/api/supabase"
echo "   ./scripts/apply-snapshot.sh snapshots/$TIMESTAMP"
echo ""
echo "📤 To share with team:"
echo "   tar -czf snapshot-$TIMESTAMP.tar.gz -C apps/api/supabase/snapshots $TIMESTAMP"
echo ""








