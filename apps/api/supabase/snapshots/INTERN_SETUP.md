# Intern Database Setup Guide

## Quick Start (5 minutes)

### Prerequisites
1. ✅ Docker Desktop is running
2. ✅ Supabase is installed (`supabase --version`)
3. ✅ You're in the project root

### Step 1: Start Supabase
```bash
cd apps/api/supabase
supabase start
```

Wait for all services to start (this takes ~30 seconds).

### Step 2: Restore the Snapshot
```bash
cd apps/api/supabase
./scripts/restore-intern-snapshot.sh
```

This will:
- ✅ Restore all 5 schemas (public, rag_data, company_data, n8n_data, langgraph)
- ✅ Load all users (auth + public)
- ✅ Load all providers and models
- ✅ Load all agents
- ✅ Load all RBAC permissions
- ✅ Load PII patterns and dictionaries

### Step 3: Verify Everything Works
```bash
# Check users
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT email FROM auth.users;"

# Check agents
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT slug, name FROM public.agents;"

# Check providers
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT name FROM public.llm_providers;"
```

### Step 4: Start n8n (if needed)
```bash
cd apps/n8n
docker-compose up -d
```

## What's Included

### Schemas
- **public** - Main orchestrator AI tables (agents, users, RBAC, etc.)
- **rag_data** - RAG collections and embeddings
- **company_data** - Company-specific data (currently empty)
- **n8n_data** - n8n workflow data
- **langgraph** - LangGraph checkpoint storage

### Seed Data
- ✅ **3 users** (auth.users + public.users)
- ✅ **4 organizations**
- ✅ **4 agents** (blog-post-writer, hr-policy-agent, data-analyst, extended-post-writer)
- ✅ **5 LLM providers** (OpenAI, Anthropic, Ollama, etc.)
- ✅ **51 LLM models** (all configured models)
- ✅ **RBAC** (5 roles, 18 permissions, 52 role-permission mappings, 9 user-org-role assignments)
- ✅ **PII handling** (6 pseudonym dictionaries, 5 redaction patterns)
- ✅ **System settings** (global configuration)

## Troubleshooting

### "Database container not running"
```bash
cd apps/api/supabase
supabase start
```

### "Snapshot directory not found"
Make sure you're in `apps/api/supabase` directory:
```bash
cd apps/api/supabase
./scripts/restore-intern-snapshot.sh
```

### "Permission denied"
Make the script executable:
```bash
chmod +x apps/api/supabase/scripts/restore-intern-snapshot.sh
```

### Want to restore a specific snapshot?
```bash
cd apps/api/supabase
./scripts/restore-intern-snapshot.sh snapshots/2025-12-04-124849
```

## Next Steps

1. **Start the API**: `npm run dev:api`
2. **Start the Web**: `npm run dev:web`
3. **Login**: Use one of the users from the snapshot
4. **Explore**: Check out the 4 agents in the UI

## Need Help?

- Check `apps/api/supabase/scripts/README.md` for more database scripts
- Check `apps/api/supabase/SETUP_GUIDE.md` for detailed setup instructions

