#!/bin/bash
# Export INTERN database snapshot - Complete setup for new developers
# Includes: ALL schemas + ALL seed data (users, providers, models, patterns, etc.)
# Purpose: Quick setup for interns/nephews/new team members

set -e  # Exit on error

# Configuration
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
DATE_DIR=$(date +%Y-%m-%d)
SNAPSHOT_DIR="apps/api/supabase/snapshots/$TIMESTAMP"
DATE_SNAPSHOT_DIR="apps/api/supabase/snapshots/$DATE_DIR"
LATEST_DIR="apps/api/supabase/snapshots/latest"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"
DB_PORT="6012"

# Verify database is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "❌ ERROR: Database container '$DB_CONTAINER' is not running!"
    echo "   Start it with: cd apps/api/supabase && supabase start"
    exit 1
fi

# Create directories
mkdir -p "$SNAPSHOT_DIR"
mkdir -p "$DATE_SNAPSHOT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📸 Creating INTERN database snapshot: $TIMESTAMP"
echo "   Complete setup for new developers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Export complete schema (ALL required schemas)
echo "📦 Step 1: Exporting complete schema structure..."
echo "   Schemas: public, rag_data, company_data, n8n_data, langgraph"

docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=public \
  --schema=rag_data \
  --schema=company_data \
  --schema=n8n_data \
  --schema=langgraph \
  --schema-only \
  --no-owner \
  --no-acl \
  > "$SNAPSHOT_DIR/schema.sql"

# Add cleanup statements at the beginning
echo "🧹 Adding cleanup statements..."
cat > "$SNAPSHOT_DIR/schema.tmp" << 'EOF'
-- Database Snapshot for Intern Setup
-- Generated: TIMESTAMP_PLACEHOLDER
-- Schemas: public, rag_data, company_data, n8n_data, langgraph
--
-- WARNING: This will DROP and recreate schemas (except public)
-- All data in these schemas will be deleted!

-- Cleanup existing schemas (WARNING: This will delete all data!)
DROP SCHEMA IF EXISTS langgraph CASCADE;
DROP SCHEMA IF EXISTS n8n_data CASCADE;
DROP SCHEMA IF EXISTS company_data CASCADE;
DROP SCHEMA IF EXISTS rag_data CASCADE;
-- Note: public schema is not dropped as it's required by PostgreSQL

-- Recreate schemas
CREATE SCHEMA IF NOT EXISTS rag_data;
CREATE SCHEMA IF NOT EXISTS company_data;
CREATE SCHEMA IF NOT EXISTS n8n_data;
CREATE SCHEMA IF NOT EXISTS langgraph;

EOF

# Replace timestamp placeholder
sed -i.bak "s/TIMESTAMP_PLACEHOLDER/$(date -u +"%Y-%m-%d %H:%M:%S UTC")/" "$SNAPSHOT_DIR/schema.tmp"
rm -f "$SNAPSHOT_DIR/schema.tmp.bak"

cat "$SNAPSHOT_DIR/schema.sql" >> "$SNAPSHOT_DIR/schema.tmp"
mv "$SNAPSHOT_DIR/schema.tmp" "$SNAPSHOT_DIR/schema.sql"

echo "   ✅ Schema exported"
echo ""

# Step 2: Export seed data from specific tables
echo "🌱 Step 2: Exporting seed data..."
echo "   Tables: users, providers, models, patterns, dictionaries, RBAC..."

# Create seed file with header
cat > "$SNAPSHOT_DIR/seed.sql" << 'EOF'
-- Intern Database Seed Data
-- Complete setup for new developers
-- Generated: TIMESTAMP_PLACEHOLDER
-- 
-- Includes:
--   - auth.users (all authentication users)
--   - public.users (all user records with values)
--   - public.llm_providers (all providers)
--   - public.llm_models (all models)
--   - public.organizations (organization structure)
--   - public.agents (all agent configurations)
--   - public.rbac_* (all RBAC tables)
--   - public.pseudonym_dictionaries (PII handling)
--   - public.redaction_patterns (PII patterns)
--   - public.system_settings (global configuration)
--   - public.organization_credentials (if any)
--
-- Disable triggers during import for speed
SET session_replication_role = replica;

EOF

# Replace timestamp placeholder
sed -i.bak "s/TIMESTAMP_PLACEHOLDER/$(date -u +"%Y-%m-%d %H:%M:%S UTC")/" "$SNAPSHOT_DIR/seed.sql"
rm -f "$SNAPSHOT_DIR/seed.sql.bak"

# Tables to include (seed data) - in dependency order
INCLUDE_TABLES=(
  # Auth tables first (required for foreign keys)
  "auth.users"
  "auth.identities"
  
  # Core configuration
  "public.organizations"
  "public.llm_providers"
  "public.llm_models"
  "public.system_settings"
  
  # Users and RBAC
  "public.users"
  "public.rbac_roles"
  "public.rbac_permissions"
  "public.rbac_role_permissions"
  "public.rbac_user_org_roles"
  
  # Agents
  "public.agents"
  
  # PII handling
  "public.pseudonym_dictionaries"
  "public.redaction_patterns"
  
  # Organization credentials
  "public.organization_credentials"
)

# Export each table individually
for table in "${INCLUDE_TABLES[@]}"; do
  schema=$(echo "$table" | cut -d'.' -f1)
  table_name=$(echo "$table" | cut -d'.' -f2)
  
  echo -n "   Exporting $table... "
  
  # Check if table exists and has data
  ROW_COUNT=$(docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
    -h localhost \
    -p 5432 \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")
  
  if [ "$ROW_COUNT" != "0" ] && [ -n "$ROW_COUNT" ]; then
    docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
      -h localhost \
      -p 5432 \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      --table="$table" \
      --data-only \
      --no-owner \
      --no-acl \
      --column-inserts \
      --disable-triggers \
      >> "$SNAPSHOT_DIR/seed.sql" 2>/dev/null && echo "✅ ($ROW_COUNT rows)" || echo "⚠️  (failed)"
  else
    echo "⏭️  (empty or missing)"
  fi
done

# Re-enable triggers
cat >> "$SNAPSHOT_DIR/seed.sql" << 'EOF'

-- Re-enable triggers
SET session_replication_role = DEFAULT;
EOF

echo "   ✅ Seed data exported"
echo ""

# Step 3: Create metadata file
echo "📋 Step 3: Creating metadata..."
cat > "$SNAPSHOT_DIR/metadata.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$DATE_DIR",
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "type": "intern-snapshot",
  "description": "Complete database snapshot for intern/new developer setup",
  "schemas": ["public", "rag_data", "company_data", "n8n_data", "langgraph"],
  "includes": {
    "schema": true,
    "auth_users": true,
    "public_users": true,
    "llm_providers": true,
    "llm_models": true,
    "organizations": true,
    "agents": true,
    "rbac": true,
    "system_settings": true,
    "organization_credentials": true,
    "pseudonym_dictionaries": true,
    "redaction_patterns": true
  },
  "purpose": "intern-setup",
  "production_ready": true,
  "db_container": "$DB_CONTAINER",
  "db_port": "$DB_PORT",
  "restore_command": "cd apps/api/supabase && ./scripts/restore-intern-snapshot.sh"
}
EOF

echo "   ✅ Metadata created"
echo ""

# Step 4: Copy to date directory and update 'latest' symlink
echo "🔗 Step 4: Updating symlinks..."
rm -rf "$DATE_SNAPSHOT_DIR"
cp -r "$SNAPSHOT_DIR" "$DATE_SNAPSHOT_DIR"
rm -rf "$LATEST_DIR"
cp -r "$SNAPSHOT_DIR" "$LATEST_DIR"
echo "   ✅ Latest snapshot updated: $LATEST_DIR"
echo "   ✅ Date snapshot updated: $DATE_SNAPSHOT_DIR"
echo ""

# Step 5: Create summary
SNAPSHOT_SIZE=$(du -sh "$SNAPSHOT_DIR" | cut -f1)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ INTERN SNAPSHOT CREATED SUCCESSFULLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Snapshot locations:"
echo "   Timestamped: $SNAPSHOT_DIR"
echo "   Date:        $DATE_SNAPSHOT_DIR"
echo "   Latest:      $LATEST_DIR"
echo ""
echo "📊 Size: $SNAPSHOT_SIZE"
echo ""
echo "📋 Contents:"
echo "   ✅ schema.sql  - Complete database structure (5 schemas)"
echo "   ✅ seed.sql    - All seed data (users, providers, models, patterns)"
echo "   ✅ metadata.json - Snapshot information"
echo ""
echo "📦 Included Schemas:"
echo "   ✅ public (orchestrator AI)"
echo "   ✅ rag_data (RAG functionality)"
echo "   ✅ company_data (company data)"
echo "   ✅ n8n_data (n8n workflows)"
echo "   ✅ langgraph (LangGraph checkpoints)"
echo ""
echo "🌱 Included Seed Data:"
echo "   ✅ auth.users (all authentication users)"
echo "   ✅ public.users (all user records)"
echo "   ✅ llm_providers (all providers)"
echo "   ✅ llm_models (all models)"
echo "   ✅ organizations (organization structure)"
echo "   ✅ agents (all agent configurations)"
echo "   ✅ RBAC (roles, permissions, assignments)"
echo "   ✅ pseudonym_dictionaries (PII handling)"
echo "   ✅ redaction_patterns (PII patterns)"
echo "   ✅ system_settings (global configuration)"
echo ""
echo "🔄 To restore this snapshot:"
echo "   cd apps/api/supabase"
echo "   ./scripts/restore-intern-snapshot.sh"
echo ""
echo "📤 To share with intern:"
echo "   Share the directory: apps/api/supabase/snapshots/$TIMESTAMP"
echo "   Or compress: tar -czf intern-snapshot-$TIMESTAMP.tar.gz -C apps/api/supabase/snapshots $TIMESTAMP"
echo ""

