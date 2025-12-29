#!/bin/bash
# =============================================================================
# INITIALIZE MULTIPLE DATABASES
# =============================================================================
# Creates separate databases for different concerns as per PRD Section 5.1
# This runs on Supabase container startup
# =============================================================================

set -e

echo "================================================"
echo "Creating multiple databases..."
echo "================================================"

# Wait for postgres to be ready
until pg_isready -U postgres; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

# Create databases
psql -v ON_ERROR_STOP=1 --username postgres <<-EOSQL
    -- Create orchestrator_ai database (main application)
    SELECT 'CREATE DATABASE orchestrator_ai'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orchestrator_ai')\gexec

    -- Create n8n_data database (N8n workflow data)
    SELECT 'CREATE DATABASE n8n_data'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n_data')\gexec

    -- Create company_data database (Company-specific data)
    SELECT 'CREATE DATABASE company_data'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'company_data')\gexec

    -- Create rag_data database (RAG collections and embeddings)
    SELECT 'CREATE DATABASE rag_data'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rag_data')\gexec
EOSQL

# Enable extensions on each database
echo "Enabling extensions..."

# Enable pgvector on rag_data
psql -v ON_ERROR_STOP=1 --username postgres --dbname rag_data <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL

# Enable common extensions on orchestrator_ai
psql -v ON_ERROR_STOP=1 --username postgres --dbname orchestrator_ai <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EOSQL

echo "================================================"
echo "Databases created successfully:"
echo "  - orchestrator_ai (main application)"
echo "  - n8n_data (N8n workflows)"
echo "  - company_data (structured company data)"
echo "  - rag_data (RAG collections with pgvector)"
echo "================================================"

# List all databases
psql -U postgres -c "\l"
