#!/bin/bash
# =============================================================================
# SETUP MULTIPLE DATABASES
# =============================================================================
# Creates separate databases for different concerns as per PRD Section 5.1
# Run this ONCE after starting Supabase for the first time
# Usage: ./apps/api/supabase/scripts/setup-databases.sh
# =============================================================================

set -e

echo "================================================"
echo "Setting up multiple databases..."
echo "================================================"

# Configuration
DB_HOST="127.0.0.1"
DB_PORT="6012"
DB_USER="postgres"
export PGPASSWORD="postgres"

# Check if Supabase is running
if ! docker ps | grep -q supabase_db_api-dev; then
  echo "Error: Supabase is not running!"
  echo "Please start Supabase first: cd apps/api && npx supabase start"
  exit 1
fi

echo "Creating databases..."

# Create databases using docker exec
# Check and create each database individually
for db in orchestrator_ai n8n_data company_data rag_data; do
  echo "Creating database: $db"
  docker exec supabase_db_api-dev psql -U postgres -c "CREATE DATABASE $db" 2>/dev/null || echo "  Database $db already exists"
done

echo ""
echo "Enabling extensions..."

# Enable pgvector on rag_data
docker exec supabase_db_api-dev psql -U postgres -d rag_data <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
    \dx
EOSQL

# Enable common extensions on orchestrator_ai
docker exec supabase_db_api-dev psql -U postgres -d orchestrator_ai <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    \dx
EOSQL

echo ""
echo "================================================"
echo "Databases created successfully:"
echo "  - orchestrator_ai (main application)"
echo "  - n8n_data (N8n workflows)"
echo "  - company_data (structured company data)"
echo "  - rag_data (RAG collections with pgvector)"
echo "================================================"
echo ""
echo "Connection strings:"
echo "  orchestrator_ai: postgresql://postgres:postgres@${DB_HOST}:${DB_PORT}/orchestrator_ai"
echo "  n8n_data:        postgresql://postgres:postgres@${DB_HOST}:${DB_PORT}/n8n_data"
echo "  company_data:    postgresql://postgres:postgres@${DB_HOST}:${DB_PORT}/company_data"
echo "  rag_data:        postgresql://postgres:postgres@${DB_HOST}:${DB_PORT}/rag_data"
echo "================================================"
echo ""

# List all databases
echo "Listing all databases..."
docker exec supabase_db_api-dev psql -U postgres -c "\l"
