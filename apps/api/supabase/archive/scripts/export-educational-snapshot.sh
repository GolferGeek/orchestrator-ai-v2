#!/bin/bash
# Export EDUCATIONAL database snapshot for production-ready starting point
# Includes: schemas, agents, models, providers, users, RBAC
# Excludes: langgraph checkpoints, conversations, tasks, deliverables

set -e  # Exit on error

# Configuration
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
SNAPSHOT_DIR="apps/api/supabase/snapshots/$TIMESTAMP"
LATEST_DIR="apps/api/supabase/snapshots/latest"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"

# Create directories
mkdir -p "$SNAPSHOT_DIR"

echo "📸 Creating EDUCATIONAL database snapshot: $TIMESTAMP"
echo "   Production-ready starting point for educational use"
echo ""

# Step 1: Export complete schema (ALL schemas, but we'll filter data later)
echo "📦 Step 1: Exporting complete schema structure..."
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

# Step 2: Export seed data from specific tables only
echo "🌱 Step 2: Exporting seed data (agents, models, providers, users, RBAC)..."

# Create seed file with header
cat > "$SNAPSHOT_DIR/seed.sql" << 'EOF'
-- Educational Database Seed Data
-- Production-ready starting point for educational use
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- 
-- Includes:
--   - Agents (all agent configurations)
--   - LLM Providers & Models (all available providers and models)
--   - Organizations (organization structure)
--   - Users (public.users and auth.users)
--   - RBAC (roles, permissions, role_permissions, user_org_roles)
--   - System Settings (global configuration)
--   - Organization Credentials (if any)
--   - Pseudonym Dictionaries (PII handling)
--   - Redaction Patterns (PII redaction)
--
-- Excludes:
--   - LangGraph checkpoints (checkpoint_*, checkpoints tables)
--   - Conversations
--   - Tasks
--   - Deliverables
--   - Plans
--   - Observability events
--   - LLM usage logs
--   - Assets
--   - Human approvals

-- Disable triggers during import for speed
SET session_replication_role = replica;

EOF

# Tables to include (seed data)
INCLUDE_TABLES=(
  "public.agents"
  "public.llm_providers"
  "public.llm_models"
  "public.organizations"
  "public.users"
  "public.rbac_roles"
  "public.rbac_permissions"
  "public.rbac_role_permissions"
  "public.rbac_user_org_roles"
  "public.system_settings"
  "public.organization_credentials"
  "public.pseudonym_dictionaries"
  "public.redaction_patterns"
)

# Export each table individually
for table in "${INCLUDE_TABLES[@]}"; do
  schema=$(echo "$table" | cut -d'.' -f1)
  table_name=$(echo "$table" | cut -d'.' -f2)
  
  echo "   Exporting $table..."
  
  # Check if table exists and has data
  if docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" psql \
    -h localhost \
    -p 5432 \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | grep -q '[1-9]'; then
    
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
      >> "$SNAPSHOT_DIR/seed.sql" 2>/dev/null || echo "   ⚠️  Failed to export $table"
  else
    echo "   ⚠️  $table is empty or doesn't exist, skipping"
  fi
done

# Export auth.users (authentication users)
echo "   Exporting auth.users..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --table="auth.users" \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  >> "$SNAPSHOT_DIR/seed.sql" 2>/dev/null || echo "   ⚠️  Failed to export auth.users"

# Export auth.identities (linked to auth.users)
echo "   Exporting auth.identities..."
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --table="auth.identities" \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  >> "$SNAPSHOT_DIR/seed.sql" 2>/dev/null || echo "   ⚠️  Failed to export auth.identities"

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
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "type": "educational-snapshot",
  "description": "Production-ready educational database snapshot - perfect starting point for learning",
  "schemas": ["public", "auth", "storage", "n8n", "company", "observability", "rag"],
  "includes": {
    "schema": true,
    "agents": true,
    "llm_providers": true,
    "llm_models": true,
    "organizations": true,
    "users": true,
    "auth_users": true,
    "rbac": true,
    "system_settings": true,
    "organization_credentials": true,
    "pseudonym_dictionaries": true,
    "redaction_patterns": true
  },
  "excludes": {
    "langgraph_checkpoints": true,
    "conversations": true,
    "tasks": true,
    "deliverables": true,
    "plans": true,
    "observability_events": true,
    "llm_usage": true,
    "assets": true,
    "human_approvals": true
  },
  "purpose": "educational",
  "production_ready": true,
  "db_container": "$DB_CONTAINER",
  "restore_command": "cd apps/api/supabase && ./scripts/apply-snapshot.sh snapshots/$TIMESTAMP"
}
EOF

echo "   ✅ Metadata created"
echo ""

# Step 4: Update 'latest' symlink
echo "🔗 Step 4: Updating 'latest' symlink..."
rm -rf "$LATEST_DIR"
cp -r "$SNAPSHOT_DIR" "$LATEST_DIR"
echo "   ✅ Latest snapshot updated"
echo ""

# Step 5: Create summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ EDUCATIONAL SNAPSHOT CREATED SUCCESSFULLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Snapshot location: $SNAPSHOT_DIR"
echo "🔗 Latest symlink:    $LATEST_DIR"
echo ""
echo "📊 Contents:"
echo "   ✅ schema.sql  - Complete database structure (all schemas)"
echo "   ✅ seed.sql    - Seed data (agents, models, providers, users, RBAC)"
echo "   ✅ metadata.json - Snapshot information"
echo ""
echo "📋 Included Data:"
echo "   ✅ Agents (all configurations)"
echo "   ✅ LLM Providers & Models"
echo "   ✅ Organizations"
echo "   ✅ Users (public + auth)"
echo "   ✅ RBAC (roles, permissions, assignments)"
echo "   ✅ System Settings"
echo "   ✅ Organization Credentials"
echo "   ✅ Pseudonym Dictionaries"
echo "   ✅ Redaction Patterns"
echo ""
echo "🚫 Excluded Data:"
echo "   ❌ LangGraph checkpoints"
echo "   ❌ Conversations"
echo "   ❌ Tasks"
echo "   ❌ Deliverables"
echo "   ❌ Plans"
echo "   ❌ Observability events"
echo "   ❌ LLM usage logs"
echo ""
echo "🔄 To restore this snapshot:"
echo "   cd apps/api/supabase"
echo "   ./scripts/apply-snapshot.sh snapshots/$TIMESTAMP"
echo ""
echo "📤 To share with team:"
echo "   tar -czf educational-snapshot-$TIMESTAMP.tar.gz -C apps/api/supabase/snapshots $TIMESTAMP"
echo ""



