# Database Setup Guide for New Users

This guide walks you through setting up the Orchestrator AI database from scratch using our snapshot system.

## Prerequisites

1. **Docker Desktop** installed and running
2. **Node.js** (v18 or higher) and npm installed
3. **Git** (to clone the repository)

## Quick Start (5 minutes)

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd orchestrator-ai-v2
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Start Supabase (First Time)

```bash
npx supabase start
```

This will:
- Download Supabase Docker images (first time only, ~2-3 minutes)
- Start all required services (PostgreSQL, Auth, Storage, etc.)
- Display connection details

**Save the output!** You'll need the `anon key` and `service_role key` for your `.env` file.

### Step 4: Setup Database from Snapshot

```bash
cd apps/api/supabase
./scripts/setup-from-snapshot.sh
```

This will:
- ✅ Check that Docker and Supabase are running
- ✅ Show you what will be installed
- ✅ Ask for confirmation
- ✅ Apply the complete database schema (all tables, functions, triggers)
- ✅ Load all seed data (users, agents, RBAC, LLM configs, etc.)
- ✅ Verify the setup completed successfully

**When prompted, type `yes` to proceed.**

### Step 5: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

Required keys:
- `SUPABASE_URL` (from Step 3 output)
- `SUPABASE_ANON_KEY` (from Step 3 output)
- `SUPABASE_SERVICE_ROLE_KEY` (from Step 3 output)
- Add any LLM provider API keys you plan to use (OpenAI, Anthropic, etc.)

### Step 6: Start the Application

```bash
# From project root
npm run dev
```

This starts:
- 🔷 API Server: http://localhost:6100
- 🟢 Web App: http://localhost:5173
- 🔵 LangGraph: http://localhost:6200

### Step 7: Login

Open http://localhost:5173 and login with:

```
Email: demo.user@playground.com
Password: demouser
```

**You're all set!** 🎉

---

## What's Included in the Snapshot?

The snapshot contains a **complete, working database** with:

### 📊 Database Structure
- ✅ All schemas: `public`, `auth`, `storage`, `n8n`, `company`, `observability`, `rag`
- ✅ All tables, indexes, constraints
- ✅ All functions and triggers
- ✅ All views and materialized views

### 👥 Users & Authentication
- ✅ Demo user account (demo.user@playground.com)
- ✅ Your organization (GolferGeek)
- ✅ Complete RBAC system (roles, permissions, assignments)
- ✅ Super admin configuration

### 🤖 Agents & Configurations
- ✅ All pre-configured agents (marketing, HR, finance, etc.)
- ✅ Agent definitions and capabilities
- ✅ Conversation templates
- ✅ Deliverable structures

### 🧠 LLM Configuration
- ✅ All LLM providers (OpenAI, Anthropic, Google, etc.)
- ✅ All models with capabilities and pricing
- ✅ Default model configurations

### 📚 RAG System (if applicable)
- ✅ Vector extension (pgvector) enabled
- ✅ RAG collections and documents
- ✅ Embedding configurations

---

## Troubleshooting

### "Docker is not running"
```bash
# Start Docker Desktop, then retry
./scripts/setup-from-snapshot.sh
```

### "Supabase container not found"
```bash
# The script will automatically run: npx supabase start
# If it fails, run manually:
npx supabase start
```

### "Permission denied" errors
```bash
# Make sure the script is executable
chmod +x ./scripts/setup-from-snapshot.sh
```

### "Port already in use"
```bash
# Check what's using the ports
lsof -i :5432  # PostgreSQL
lsof -i :6100  # API
lsof -i :5173  # Web

# Stop conflicting services or change ports in config
```

### Database connection issues
```bash
# Verify Supabase is running
npx supabase status

# Check container logs
docker logs supabase_db_api-dev
```

---

## Advanced: Manual Setup

If the automated script doesn't work, you can apply the snapshot manually:

```bash
# 1. Start Supabase
npx supabase start

# 2. Apply schema
docker exec -i -e PGPASSWORD=postgres supabase_db_api-dev psql \
  -h localhost \
  -p 5432 \
  -U postgres \
  -d postgres \
  < apps/api/supabase/snapshots/latest/schema.sql

# 3. Apply seed data
docker exec -i -e PGPASSWORD=postgres supabase_db_api-dev psql \
  -h localhost \
  -p 5432 \
  -U postgres \
  -d postgres \
  < apps/api/supabase/snapshots/latest/seed.sql
```

---

## For Instructors/Administrators

### Creating a New Snapshot

When you make significant database changes and want to update the snapshot for students:

```bash
cd apps/api/supabase
./scripts/export-full-snapshot.sh
```

This creates:
- New timestamped snapshot in `snapshots/YYYY-MM-DD-HHMMSS/`
- Compressed backup in `backups/full-backup-*.sql.gz`
- Updates `snapshots/latest/` to point to the new snapshot

### Sharing Snapshots

To share a snapshot with students:

```bash
# Create a tarball
tar -czf snapshot-latest.tar.gz -C apps/api/supabase/snapshots latest/

# Students extract and use:
tar -xzf snapshot-latest.tar.gz -C apps/api/supabase/snapshots/
./apps/api/supabase/scripts/setup-from-snapshot.sh
```

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs: `docker logs supabase_db_api-dev`
3. Verify environment variables in `.env`
4. Ensure all prerequisites are installed

**Happy coding!** 🚀

