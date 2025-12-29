#!/bin/bash
# =============================================================================
# MIGRATE ORCHESTRATOR_AI DATABASE
# =============================================================================
# Applies Phase 1 migrations to orchestrator_ai database
# Usage: ./apps/api/supabase/scripts/migrate-orchestrator-ai.sh
# =============================================================================

set -e

echo "================================================"
echo "Migrating orchestrator_ai database..."
echo "================================================"

# Configuration
DB_HOST="127.0.0.1"
DB_PORT="6012"
DB_NAME="orchestrator_ai"
DB_USER="postgres"
export PGPASSWORD="postgres"

# Check if Supabase is running
if ! docker ps | grep -q supabase_db_api-dev; then
  echo "Error: Supabase is not running!"
  echo "Please start Supabase first: cd apps/api && npx supabase start"
  exit 1
fi

# Apply migrations
MIGRATIONS_DIR="apps/api/supabase/migrations"

echo "Applying migrations from $MIGRATIONS_DIR..."

for file in $(ls -1 $MIGRATIONS_DIR/*.sql | grep -v "\.old$" | sort); do
  filename=$(basename "$file")
  echo "  Applying: $filename"
  docker exec -i supabase_db_api-dev psql -U $DB_USER -d $DB_NAME < "$file"
done

echo ""
echo "================================================"
echo "Migrations applied successfully!"
echo "================================================"
echo ""

# Verify tables
echo "Verifying tables in orchestrator_ai database..."
docker exec supabase_db_api-dev psql -U $DB_USER -d $DB_NAME -c "\dt"
