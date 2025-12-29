-- =============================================================================
-- CREATE MULTIPLE DATABASES
-- =============================================================================
-- Creates separate databases for different concerns as per PRD Section 5.1
-- Run this ONCE after initial Supabase start
-- =============================================================================

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

-- List all databases to verify
\l
